import { Stack, StackProps, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
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
}

/**
 * API Gateway HTTP API + Cognito JWT authorizer (handoff §3).
 * One Lambda per handler, least-privilege IAM to the table.
 *
 * M2 routes: POST /orders (create), GET /orders (buyer history).
 * Stripe /checkout + /webhooks land in #11.
 */
export class ApiStack extends Stack {
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { cfg, table, userPool, userPoolClient, corsOrigins } = props;

    const handlersDir = path.join(__dirname, "..", "..", "services", "src", "handlers");

    const makeFn = (fnId: string, entryFile: string): NodejsFunction =>
      new NodejsFunction(this, fnId, {
        entry: path.join(handlersDir, entryFile),
        handler: "handler",
        // Node 20 runtime was deprecated 2026-04-30; use the current LTS.
        runtime: Runtime.NODEJS_22_X,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { TABLE_NAME: table.tableName },
        bundling: {
          // AWS SDK v3 is provided by the Node runtime — don't bundle it.
          externalModules: ["@aws-sdk/*"],
          minify: true,
          sourceMap: true,
          target: "node22",
        },
      });

    const createOrderFn = makeFn("CreateOrderFn", "create-order.ts");
    const listOrdersFn = makeFn("ListOrdersFn", "list-orders.ts");

    // Least-privilege: writer gets RW, history reader gets read-only.
    table.grantReadWriteData(createOrderFn);
    table.grantReadData(listOrdersFn);

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

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
  }
}
