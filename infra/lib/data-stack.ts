import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { EnvConfig, APP_NAME } from "./config";

export interface DataStackProps extends StackProps {
  readonly cfg: EnvConfig;
}

/**
 * DynamoDB single-table for the whole platform (handoff §5).
 *
 * Table: `gift-platform`
 *   PK / SK are generic partition & sort keys used across every entity
 *   (USER#, ORDER#, CARD#, TOKEN#, EVT#, …).
 *
 * GSIs:
 *   - GSI1 byBuyer   : buyerId / createdAt        (buyer history)
 *   - GSI2 byState   : state   / createdAt        (admin filters/dashboards)
 *   - GSI3 byToken   : claimTokenHash             (claim resolution)
 *
 * Monetary values are ALWAYS stored as integer cents — no floats anywhere.
 */
export class DataStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { cfg } = props;

    this.table = new dynamodb.Table(this, "GiftPlatformTable", {
      tableName: `${APP_NAME}-${cfg.stage}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // Full before/after images feed the immutable audit pipeline (§3).
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      // prod keeps data on stack deletion; dev is disposable.
      removalPolicy: cfg.isEphemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // GSI1 — buyer history: all orders/cards for a buyer, newest first.
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "buyerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 — admin dashboards/filters by canonical state, newest first.
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "state", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3 — claim resolution by hashed token (only the SHA-256 hash is stored).
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: { name: "claimTokenHash", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
