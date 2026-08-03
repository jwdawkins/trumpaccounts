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

// Public marketing site: static S3 + CloudFront. Custom domain is opt-in via
// env — MARKETING_DOMAINS (comma-separated) + MARKETING_CERT_ARN (us-east-1);
// absent → served on the *.cloudfront.net domain.
const marketingDomains = process.env.MARKETING_DOMAINS
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// The marketing site now calls the API directly (catalog + authed orders/checkout),
// so its origins must be allowed by CORS. Dev servers: web/ on 5173, marketing/ on
// 5174. Prod: the marketing custom domains (https), defaulting to the known ones.
const marketingProdOrigins = (marketingDomains ?? [
  "trumpaccountgiftcards.com",
  "www.trumpaccountgiftcards.com",
]).map((d) => `https://${d}`);
// The `liono` shared dev server also hosts the marketing dev build (port 5174),
// reached over LAN / Tailscale — allow those origins so full-stack testing works
// without an SSH tunnel. Dev-stage convenience only.
const lionoDevOrigins = [
  "http://liono:5174",
  "http://10.7.14.120:5174", // LAN
  "http://100.73.224.46:5174", // Tailscale
];
const corsOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...lionoDevOrigins,
  ...marketingProdOrigins,
];

new ApiStack(app, stackName(cfg, "api"), {
  cfg,
  env,
  table: data.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  corsOrigins,
  webBaseUrl: "http://localhost:5173",
});
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
