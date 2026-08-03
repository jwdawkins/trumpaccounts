#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { resolveEnv, stackName } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { AuditStack } from "../lib/audit-stack";
import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";
import { MarketingStack } from "../lib/marketing-stack";

const app = new App();
const cfg = resolveEnv();
const env = { account: cfg.account, region: cfg.region };

const data = new DataStack(app, stackName(cfg, "data"), { cfg, env });

new AuditStack(app, stackName(cfg, "audit"), {
  cfg,
  env,
  table: data.table,
});

const auth = new AuthStack(app, stackName(cfg, "auth"), { cfg, env });

new ApiStack(app, stackName(cfg, "api"), {
  cfg,
  env,
  table: data.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  corsOrigins: ["http://localhost:5173"],
  webBaseUrl: "http://localhost:5173",
});

// Public marketing site: static S3 + CloudFront. Custom domain is opt-in via
// env — MARKETING_DOMAINS (comma-separated) + MARKETING_CERT_ARN (us-east-1);
// absent → served on the *.cloudfront.net domain.
const marketingDomains = process.env.MARKETING_DOMAINS
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
new MarketingStack(app, stackName(cfg, "marketing"), {
  cfg,
  env,
  domainNames: marketingDomains,
  certificateArn: process.env.MARKETING_CERT_ARN,
});

// Consistent tags across every resource for cost allocation & ownership.
Tags.of(app).add("project", "gift-platform");
Tags.of(app).add("stage", cfg.stage);
Tags.of(app).add("managedBy", "cdk");
