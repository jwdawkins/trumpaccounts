import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { CfnDeliveryStream } from "aws-cdk-lib/aws-kinesisfirehose";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import { EnvConfig, APP_NAME } from "./config";

export interface AuditStackProps extends StackProps {
  readonly cfg: EnvConfig;
  readonly table: dynamodb.Table;
}

/**
 * Immutable audit pipeline (handoff §3, §8):
 *   DynamoDB Streams -> EventBridge Pipe -> Kinesis Firehose -> S3 (Object Lock)
 *
 * Every state transition already mirrored into the table (EVT# items) flows,
 * via the table stream, into a WORM S3 bucket partitioned by date. This is the
 * forensic source of truth; DynamoDB holds only current state.
 *
 * Object Lock mode is stage-aware: COMPLIANCE (undeletable by anyone, incl.
 * root) in prod; GOVERNANCE (immutable to app roles, override-able by ops) in
 * dev so throwaway environments remain tear-down-able. Either way, NO app role
 * is ever granted delete/bypass permissions on this bucket.
 */
export class AuditStack extends Stack {
  public readonly auditBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AuditStackProps) {
    super(scope, id, props);
    const { cfg, table } = props;

    const retention = cfg.isEphemeral
      ? s3.ObjectLockRetention.governance(Duration.days(1))
      : s3.ObjectLockRetention.compliance(Duration.days(365 * 7));

    this.auditBucket = new s3.Bucket(this, "AuditBucket", {
      bucketName: `${APP_NAME}-${cfg.stage}-audit-${cfg.account}`,
      versioned: true,
      objectLockEnabled: true,
      objectLockDefaultRetention: retention,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      // Audit data must outlive the stack; never auto-destroyed.
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // --- Firehose delivery role: write to the audit bucket only. ---
    const firehoseRole = new iam.Role(this, "FirehoseRole", {
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
      description: "Firehose -> audit S3 (put only; no delete/bypass)",
    });
    // Intentionally NO s3:DeleteObject / s3:BypassGovernanceRetention.
    this.auditBucket.grantWrite(firehoseRole);

    const deliveryStream = new CfnDeliveryStream(this, "AuditDeliveryStream", {
      deliveryStreamName: `${APP_NAME}-${cfg.stage}-audit`,
      deliveryStreamType: "DirectPut",
      extendedS3DestinationConfiguration: {
        bucketArn: this.auditBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        // Hive-style date partitioning for cheap Athena queries later.
        prefix:
          "events/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/",
        errorOutputPrefix:
          "errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/",
        bufferingHints: { intervalInSeconds: 60, sizeInMBs: 64 },
        compressionFormat: "GZIP",
      },
    });

    // --- EventBridge Pipe: DDB stream -> Firehose. ---
    const pipeRole = new iam.Role(this, "AuditPipeRole", {
      assumedBy: new iam.ServicePrincipal("pipes.amazonaws.com"),
      description: "Pipe: read DDB stream, put to audit Firehose",
    });
    // Read the table's DynamoDB stream.
    pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
        ],
        resources: [table.tableStreamArn!],
      }),
    );
    // Put records into the delivery stream.
    pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
        resources: [deliveryStream.attrArn],
      }),
    );

    new CfnPipe(this, "AuditPipe", {
      name: `${APP_NAME}-${cfg.stage}-audit`,
      roleArn: pipeRole.roleArn,
      source: table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: "LATEST",
          batchSize: 100,
          maximumBatchingWindowInSeconds: 30,
        },
      },
      target: deliveryStream.attrArn,
      targetParameters: {
        // Firehose target takes records as-is; no transform in M1.
      },
    });
  }
}
