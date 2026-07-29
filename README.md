# Trump Account Gift Card Program

A gift card platform where a buyer splits a gift between a contribution to the
recipient's **Trump Account** (federal tax-advantaged child savings account) and
an optional retail gift card fulfilled via **Tremendous**.

Full design & decisions: [`dev handoff.md`](./dev%20handoff.md).

## Stack

- **Infra:** AWS CDK (TypeScript) — one stack per concern (`infra/`)
- **Compute:** AWS Lambda (Node 20, TS), API Gateway HTTP API
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
infra/    CDK app — DataStack, AuthStack, (AsyncStack, ApiStack, WebStack to come)
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

- **M1** Foundation — stacks, data table, audit pipeline, Cognito, SPA skeleton, CI ← *in progress*
- **M2** Buyer & payments
- **M3** Recipient claim
- **M4** Verification & fulfillment
- **M5** Admin portal
- **M6** Hardening
