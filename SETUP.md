# New-machine setup

Everything needed to clone this repo on a fresh machine and continue development.
The deployed **dev** environment lives in AWS and keeps running regardless of your
machine — a new machine is only needed to **edit, run locally, and redeploy**.

## 1. Toolchain

| Tool | Notes |
|---|---|
| **Node** ≥ 20 (v22/24 fine) + **npm** | Lambda runtime is Node 22; local just needs a modern Node |
| **git** | |
| **AWS CLI v2** | SSO auth. On Windows it installs to `C:\Program Files\Amazon\AWSCLIV2\aws.exe` and may not be on PATH — call the full path or use PowerShell |
| **Docker Desktop** (running) | **Required for `cdk deploy`/`cdk synth`** — the Trump-funding worker is a container-image Lambda, so CDK builds a Docker image on every synth/deploy. No Docker = can't deploy |
| CDK | Not global — used via `npx cdk` |

## 2. AWS access (IAM Identity Center / SSO)

No static keys. Add this profile to `~/.aws/config` (`C:\Users\<you>\.aws\config` on Windows):

```ini
[profile trump-dev]
sso_start_url = https://ssoins-66840f0c0aa94d18.portal.us-east-2.app.aws
sso_region = us-east-2
sso_account_id = 353138588369
sso_role_name = AdministratorAccess
region = us-east-2
output = json
```

Then log in (opens a browser; token lasts ~a day, re-run when it expires):

```bash
aws sso login --profile trump-dev
```

- Dev account: **353138588369**, region **us-east-2**.
- Verify: `aws sts get-caller-identity --profile trump-dev`.

## 3. Clone + install

```bash
git clone https://github.com/jwdawkins/trumpaccounts.git
cd trumpaccounts
npm install          # installs all workspaces: infra/, services/, web/
```

`node_modules` is not committed, so `npm install` is required.

## 4. Web SPA config

The SPA reads public config from `web/.env` (not committed). Copy the template
and fill with the current dev values:

```bash
cp web/.env.example web/.env
```

Current **dev** values (public SPA config, not secrets):

```ini
VITE_API_URL=https://8ouobfbd31.execute-api.us-east-2.amazonaws.com
VITE_AWS_REGION=us-east-2
VITE_USER_POOL_ID=us-east-2_JAjHCzocj
VITE_USER_POOL_CLIENT_ID=77csii97v8k3rt889vc3m86u3j
```

Run the dev server: `npm run dev -w web` → http://localhost:5173

## 5. Funding worker (Playwright)

`funding/` is a **standalone local proving harness** (NOT an npm workspace) for
driving a real contribution link headed. Production runs the same provider in
`services/` on a container-image Lambda. To use the local harness:

```bash
cd funding
npm install
npx playwright install chromium      # one-time, downloads the browser
node src/run.mjs --url "https://contribute.trumpaccount.com/…/?secret=…" --amount 2500 --from "Test" --headed
```

## 6. Build / test / deploy

```bash
npm run typecheck                    # all workspaces
npm test                             # unit tests
cd infra
npx cdk deploy gift-platform-dev-api --require-approval never --profile trump-dev
```

Stacks: `gift-platform-dev-{data,audit,auth,api}`. Docker must be running for any
`cdk synth`/`cdk deploy` (container-image funding Lambda).

## 7. What you do NOT need to recreate

These live in the AWS dev account, not on your machine — a fresh clone inherits
them automatically:

- **Deployed stacks** (data/audit/auth/api) — already live and running.
- **CDK bootstrap** — already done on the account.
- **Secrets Manager values** — `gift-platform-dev-stripe`,
  `gift-platform-dev-tremendous-catalog`, `gift-platform-dev-tremendous-orders`
  hold the real keys and persist. You only re-paste keys when standing up a
  **new** AWS account, or after a secret is recreated by a destructive redeploy.
- **DynamoDB data**, S3 buckets, Cognito pool/users.

## 8. Gotchas

- **SSO token expires ~daily** → `aws sso login --profile trump-dev`.
- **Docker required for deploy** — the funding worker's `DockerImageFunction`
  makes every `cdk synth`/`deploy` build an image.
- **PowerShell**: no bash heredocs/subshells; pass JSON to `aws` via `file://`
  or use `Invoke-RestMethod`.
- Repo currently lives in OneDrive on the primary machine — watch for
  `node_modules`/`cdk.out` sync noise (both are gitignored).
