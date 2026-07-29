import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
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

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${APP_NAME}-${cfg.stage}`,
      // Essentials plan unlocks choice-based auth incl. EMAIL_OTP.
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
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
