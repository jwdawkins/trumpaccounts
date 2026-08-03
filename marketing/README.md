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

`/` (Home, incl. the interactive gift configurator), `/shop` (**Coming Soon**
placeholder — purchasing isn't live pre-launch), `/how-it-works`,
`/about-trump-accounts`, `/faq`, `/contact`. Launch is **July 2026** (waitlist).

## Forms are stubbed

`src/lib/api-client.ts` is a local stand-in for the Replit API client. The
waitlist + contact forms show a success toast and `console.info` the payload —
**there is no backend**. To wire a real one, replace the body of `simulateSubmit`
with a `fetch(...)`; the form components don't need to change.

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
