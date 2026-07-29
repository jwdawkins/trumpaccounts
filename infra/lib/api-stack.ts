import { Stack, StackProps, Duration, CfnOutput, SecretValue } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { EnvConfig, APP_NAME } from "./config";

export interface ApiStackProps extends StackProps {
  readonly cfg: EnvConfig;
  readonly table: dynamodb.Table;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
  /** Allowed browser origins for CORS (SPA dev + prod). */
  readonly corsOrigins: string[];
  /** Base URL of the SPA, used for Stripe success/cancel + claim links. */
  readonly webBaseUrl: string;
}

/**
 * API Gateway HTTP API + Cognito JWT authorizer (handoff §3).
 * One Lambda per handler, least-privilege IAM.
 *
 * Routes:
 *   POST /orders          (JWT)  create order
 *   GET  /orders          (JWT)  buyer history
 *   POST /checkout        (JWT)  create Stripe Checkout Session
 *   POST /webhooks/stripe (none) Stripe webhook — auth is signature verification
 *
 * Webhooks are signature-verified then buffered to an SQS FIFO queue; a
 * processor Lambda drains it idempotently (§6.2).
 */
export class ApiStack extends Stack {
  public readonly httpApi: HttpApi;
  public readonly stripeSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { cfg, table, userPool, userPoolClient, corsOrigins, webBaseUrl } = props;

    const handlersDir = path.join(__dirname, "..", "..", "services", "src", "handlers");

    // Stripe credentials (§8). Placeholder values here; the REAL secret key and
    // webhook signing secret are pasted into this secret in the AWS console.
    this.stripeSecret = new secretsmanager.Secret(this, "StripeSecret", {
      secretName: `${APP_NAME}-${cfg.stage}-stripe`,
      description: "Stripe secretKey + webhookSigningSecret (set values in console)",
      secretObjectValue: {
        secretKey: SecretValue.unsafePlainText("REPLACE_ME_sk_test"),
        webhookSigningSecret: SecretValue.unsafePlainText("REPLACE_ME_whsec"),
      },
    });

    // Webhook buffer (FIFO so eventId dedup + ordering hold) with a DLQ.
    const webhookDlq = new sqs.Queue(this, "WebhookDlq", {
      queueName: `${APP_NAME}-${cfg.stage}-webhooks-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      retentionPeriod: Duration.days(14),
    });
    const webhookQueue = new sqs.Queue(this, "WebhookQueue", {
      queueName: `${APP_NAME}-${cfg.stage}-webhooks.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: webhookDlq, maxReceiveCount: 5 },
    });

    const makeFn = (
      fnId: string,
      entryFile: string,
      env: Record<string, string> = {},
    ): NodejsFunction =>
      new NodejsFunction(this, fnId, {
        entry: path.join(handlersDir, entryFile),
        handler: "handler",
        runtime: Runtime.NODEJS_22_X,
        memorySize: 256,
        timeout: Duration.seconds(15),
        environment: { TABLE_NAME: table.tableName, ...env },
        bundling: {
          externalModules: ["@aws-sdk/*"], // provided by the runtime; stripe IS bundled
          minify: true,
          sourceMap: true,
          target: "node22",
        },
      });

    // --- HTTP handlers ---
    const createOrderFn = makeFn("CreateOrderFn", "create-order.ts");
    const listOrdersFn = makeFn("ListOrdersFn", "list-orders.ts");
    const checkoutFn = makeFn("CheckoutFn", "checkout.ts", {
      STRIPE_SECRET_ARN: this.stripeSecret.secretArn,
      WEB_BASE_URL: webBaseUrl,
    });
    const webhookReceiverFn = makeFn("WebhookReceiverFn", "stripe-webhook-receiver.ts", {
      STRIPE_SECRET_ARN: this.stripeSecret.secretArn,
      WEBHOOK_QUEUE_URL: webhookQueue.queueUrl,
    });
    const webhookProcessorFn = makeFn("WebhookProcessorFn", "stripe-webhook-processor.ts", {
      WEB_BASE_URL: webBaseUrl,
    });
    webhookProcessorFn.addEventSource(
      new SqsEventSource(webhookQueue, { batchSize: 10, reportBatchItemFailures: true }),
    );

    // --- least-privilege grants ---
    table.grantReadWriteData(createOrderFn);
    table.grantReadData(listOrdersFn);
    table.grantReadWriteData(checkoutFn);
    table.grantReadWriteData(webhookProcessorFn);
    this.stripeSecret.grantRead(checkoutFn);
    this.stripeSecret.grantRead(webhookReceiverFn);
    webhookQueue.grantSendMessages(webhookReceiverFn);

    const authorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${cfg.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] },
    );

    this.httpApi = new HttpApi(this, "HttpApi", {
      apiName: `${APP_NAME}-${cfg.stage}`,
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ["authorization", "content-type", "idempotency-key"],
        maxAge: Duration.hours(1),
      },
    });

    this.httpApi.addRoutes({
      path: "/orders",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateOrderInt", createOrderFn),
      authorizer,
    });
    this.httpApi.addRoutes({
      path: "/orders",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListOrdersInt", listOrdersFn),
      authorizer,
    });
    this.httpApi.addRoutes({
      path: "/checkout",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CheckoutInt", checkoutFn),
      authorizer,
    });
    // Public — Stripe calls this; the signature check is the auth.
    this.httpApi.addRoutes({
      path: "/webhooks/stripe",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("WebhookInt", webhookReceiverFn),
    });

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
    new CfnOutput(this, "StripeSecretName", { value: this.stripeSecret.secretName });
    new CfnOutput(this, "WebhookUrl", {
      value: `${this.httpApi.apiEndpoint}/webhooks/stripe`,
    });
  }
}
