import { Stack, StackProps, RemovalPolicy, Duration, SecretValue } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { EnvConfig, APP_NAME } from "./config";

export interface AuthStackProps extends StackProps {
  readonly cfg: EnvConfig;
}

/**
 * Cognito auth (handoff §3).
 *
 * One user pool, email-based sign-in. Groups: `buyers` (default) and `admins`.
 * Recipients never need Cognito unless they opt in.
 *
 * M2: passwordless email-OTP ("USER_AUTH", D1) is enabled via the Essentials
 * feature plan + choice-based sign-in. A lightweight account is created/entered
 * AT checkout (email + one-time code), never gating browse. Password remains an
 * allowed factor as a fallback and for admin/test token minting in dev.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { cfg } = props;

    const handlersDir = path.join(__dirname, "..", "..", "services", "src", "handlers");

    // --- Auth email via Brevo (CustomEmailSender) -------------------------
    // Cognito's default emailer is unbranded + rate-limited, so we route the
    // OTP/verification email through Brevo. Cognito encrypts the code with this
    // KMS key and hands it to the sender Lambda, which decrypts + sends via Brevo.
    const customSenderKey = new kms.Key(this, "CustomEmailSenderKey", {
      description: `${APP_NAME}-${cfg.stage} Cognito custom email sender`,
      enableKeyRotation: true,
      removalPolicy: cfg.isEphemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
    // Cognito encrypts the code on our behalf, so it needs use of the key.
    customSenderKey.grant(
      new ServicePrincipal("cognito-idp.amazonaws.com"),
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey*",
      "kms:CreateGrant",
      "kms:DescribeKey",
    );

    // Brevo transactional-email credentials — REAL values set in the console.
    const brevoSecret = new secretsmanager.Secret(this, "BrevoSecret", {
      secretName: `${APP_NAME}-${cfg.stage}-brevo`,
      description: "Brevo apiKey + verified senderEmail/senderName (set values in console)",
      secretObjectValue: {
        apiKey: SecretValue.unsafePlainText("REPLACE_ME_brevo_api_key"),
        senderEmail: SecretValue.unsafePlainText("REPLACE_ME_verified_sender@example.com"),
        senderName: SecretValue.unsafePlainText("Trump Account Gift Cards"),
      },
    });

    const emailSenderFn = new NodejsFunction(this, "CustomEmailSenderFn", {
      entry: path.join(handlersDir, "custom-email-sender.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(15),
      environment: {
        CUSTOM_SENDER_KEY_ARN: customSenderKey.keyArn,
        BREVO_SECRET_ARN: brevoSecret.secretArn,
      },
      bundling: {
        externalModules: ["@aws-sdk/*"], // runtime provides the AWS SDK
        minify: true,
        sourceMap: true,
        target: "node22",
      },
    });
    customSenderKey.grantDecrypt(emailSenderFn);
    brevoSecret.grantRead(emailSenderFn);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${APP_NAME}-${cfg.stage}`,
      // Essentials plan unlocks choice-based auth incl. EMAIL_OTP.
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      // Route all auth emails through Brevo instead of Cognito's default emailer.
      customSenderKmsKey: customSenderKey,
      lambdaTriggers: { customEmailSender: emailSenderFn },
      signInPolicy: {
        allowedFirstAuthFactors: { password: true, emailOtp: true },
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cfg.isEphemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // Groups: buyers (default persona) + admins (gate /admin routes).
    new cognito.CfnUserPoolGroup(this, "BuyersGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "buyers",
      description: "Default buyer persona",
      precedence: 10,
    });
    new cognito.CfnUserPoolGroup(this, "AdminsGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "admins",
      description: "Admin portal access",
      precedence: 1,
    });

    // Public SPA client (no secret) — browser-based auth.
    // `user` enables choice-based USER_AUTH (email-OTP) for the SPA.
    // `adminUserPassword` is dev-only, so smoke tests can mint tokens via CLI.
    this.userPoolClient = this.userPool.addClient("SpaClient", {
      userPoolClientName: `${APP_NAME}-${cfg.stage}-spa`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        user: true,
        adminUserPassword: cfg.isEphemeral,
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });
  }
}
