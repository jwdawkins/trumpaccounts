# Marketing site — Trump Account Gift Cards

Public marketing/landing site, live at **https://trumpaccountgiftcards.com**.
Static Vite + React SPA hosted on AWS S3 + CloudFront, fronted by Cloudflare
(proxied DNS). Separate from the gift-platform app in [`../web`](../web).

## Origin

Reconstructed from a Replit-built project (`@jwdawkins/Trump-Card-Gift`). The raw
Replit export lives at `~/trump-card-gift.zip` (not in the repo). This tree is the
cleaned-up, standalone version: Replit-only plugins, the pnpm `catalog:`/workspace
deps, and the `@workspace/api-client-react` package were removed. Concrete
dependency versions match the Replit catalog (React 19.1, Vite 7, Tailwind 4.1,
etc.).

## Stack

- Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui, wouter (routing),
  @tanstack/react-query, recharts, framer-motion
- Fonts: Playfair Display (serif display) + Inter (body), via a single
  preconnected `<link>` in `index.html`

## Pages

`/` (Home, incl. the interactive gift configurator), `/shop` (the live gift
storefront — configurator + cart + checkout), `/how-it-works`,
`/about-trump-accounts`, `/faq`, `/contact`. Launch is **July 2026** (waitlist).

## Storefront (gift purchasing)

The gift-card storefront now lives here (it replaced the old form in
[`../web`](../web)). The configurator builds a gift, adds it to a cart, and the
checkout dialog signs the buyer in via Cognito email OTP, collects per-gift
recipient/delivery details, and calls the platform API (`POST /orders` +
`POST /checkout` → Stripe). The transactional code is ported from `web/`:
`src/lib/{api,auth,cart,amplify,format}.ts` and
`src/components/{CartPanel,CheckoutDialog}.tsx`.

### Required env (public SPA config, not secrets)

The site calls the API + Cognito directly, so it needs the same four `VITE_*`
vars as `web/`. Copy `.env.example` → `.env` and fill them:

```
VITE_API_URL, VITE_AWS_REGION, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID
```

⚠️ These are **baked into `dist/` at `npm run build` time**, not read at CDK
deploy time — they must be present in the environment when you build, *before*
`deploy:marketing`. The API must also allow this site's origin: the marketing
domains (and `http://localhost:5174` for dev) are in the API's `corsOrigins`
([`../infra/bin/app.ts`](../infra/bin/app.ts)) — changing them requires
redeploying the `api` stack.

## Forms are stubbed

The **waitlist + contact** forms are still stubbed: `src/lib/api-client.ts` is a
local stand-in that shows a success toast and `console.info`s the payload — no
backend. (The gift storefront above is *not* stubbed.) To wire these up, replace
the body of `simulateSubmit` with a `fetch(...)`; the form components don't change.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # -> dist/  (what gets deployed)
npm run preview   # serve the built dist locally
```

## Deploy

The site is deployed by the CDK stack `gift-platform-dev-marketing`
([`../infra/lib/marketing-stack.ts`](../infra/lib/marketing-stack.ts)):
private S3 bucket → CloudFront (Origin Access Control) → Cloudflare (proxied).

```bash
npm run build                      # in this dir first
cd ../infra && npm run deploy:marketing
```

⚠️ The custom domain (apex + www) is attached to CloudFront via the
`MARKETING_DOMAINS` + `MARKETING_CERT_ARN` env vars. **`npm run deploy:marketing`
bakes them in** — deploying the stack *without* them (e.g. a bare
`cdk deploy gift-platform-dev-marketing`) removes the aliases and breaks the
domain. Always use the script.
