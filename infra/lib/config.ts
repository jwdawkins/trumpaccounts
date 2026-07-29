/**
 * Central configuration for the platform's CDK app.
 *
 * Account/region resolve from CDK context or the CLI environment so the same
 * code deploys to dev (353138588369 / us-east-2) and, later, prod.
 */
export interface EnvConfig {
  /** Short stage name, drives stack names & removal policies. */
  readonly stage: string;
  /** AWS account id. */
  readonly account: string;
  /** AWS region. */
  readonly region: string;
  /** Whether this is a throwaway/dev environment (looser removal policies). */
  readonly isEphemeral: boolean;
}

export const APP_NAME = "gift-platform";

export function resolveEnv(): EnvConfig {
  const stage = process.env.STAGE ?? "dev";
  const account =
    process.env.CDK_DEPLOY_ACCOUNT ??
    process.env.CDK_DEFAULT_ACCOUNT ??
    "353138588369";
  const region =
    process.env.CDK_DEPLOY_REGION ??
    process.env.CDK_DEFAULT_REGION ??
    "us-east-2";

  return {
    stage,
    account,
    region,
    isEphemeral: stage !== "prod",
  };
}

/** Consistent stack naming: `gift-platform-<stage>-<concern>`. */
export function stackName(cfg: EnvConfig, concern: string): string {
  return `${APP_NAME}-${cfg.stage}-${concern}`;
}
