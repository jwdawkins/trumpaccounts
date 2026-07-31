# Trump Account Gift Card Program

A gift card platform where a buyer splits a gift between a contribution to the
recipient's **Trump Account** (federal tax-advantaged child savings account) and
an optional retail gift card fulfilled via **Tremendous**.

Full design & decisions: [`dev handoff.md`](./dev%20handoff.md).
New machine / getting started: [`SETUP.md`](./SETUP.md).

## Stack

- **Infra:** AWS CDK (TypeScript) — one stack per concern (`infra/`)
- **Compute:** AWS Lambda (Node 22, TS), API Gateway HTTP API. The async
  Trump-Account funding worker is a **container-image Lambda** running Playwright
  Chromium (see [`funding/`](./funding) + `services/Dockerfile.funding`).
- **Data:** DynamoDB single-table (`gift-platform`) + immutable audit log to S3 Object Lock
- **Auth:** Amazon Cognito (buyers/admins groups)
- **Frontend:** React + Vite + Tailwind SPA (`web/`)
- **Integrations:** Stripe (payments), Tremendous (gift cards), Twilio (SMS/MMS)

## AWS account

- Dev account: `353138588369` (region `us-east-2`)
- Access: IAM Identity Center SSO, profile `trump-dev`
- Re-auth when the SSO token expires: `aws sso login --profile trump-dev`

## Layout

```
infra/    CDK app — DataStack, AuditStack, AuthStack, ApiStack (WebStack to come)
services/ Lambda handlers + domain/data/funding logic (TS)
funding/  standalone local Playwright proving harness (prod runs in services/)
web/      React SPA — buyer (/), recipient (/claim/:token), admin (/admin)
```

## Common commands

```bash
npm install                 # install all workspaces
npm run typecheck           # typecheck every workspace
npm test                    # run unit tests
npm run synth               # cdk synth (infra)
```

## Build order (see handoff §10)

- **M1** Foundation — stacks, data table, audit pipeline, Cognito, SPA skeleton, CI ✅
- **M2** Buyer & payments ✅
- **M3** Recipient claim ✅
- **M4** Verification & fulfillment ✅
- **M5** Admin portal ← *next*
- **M6** Hardening

Beyond the milestones: async Trump-Account funding pipeline (auto verify →
contribute → transfer, with retries/sweeper) is live, with the real Playwright
funding worker deployed on a container-image Lambda; gift-card ordering
(Tremendous) is async + auto-fulfilled. Remaining on funding: real debit-card
submit + captcha handling (human-in-the-loop).
