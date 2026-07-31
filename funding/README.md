# Trump Account funding worker

Server-side, headless-browser worker that funds a recipient's **Trump Account**
by driving their contribution link (**Robinhood Securities, on behalf of the
U.S. Treasury**) exactly like a person would. This is the real implementation of
`TrumpAccountProvider.initiateTransfer` — the money actually moves by completing
the Robinhood contribution page, **on behalf of the gifter** (the buyer already
paid the full gift via Stripe).

It runs **outside** the zip API Lambdas (needs Chromium). **This `funding/` dir
is the standalone local proving harness** (`src/run.mjs`, drive a link headed to
eyeball the flow). **Production runs the same real provider** —
[`services/src/funding/playwright-provider.ts`](../services/src/funding/playwright-provider.ts)
— **on a container-image Lambda** (SQS-triggered async funding worker); see
[`services/Dockerfile.funding`](../services/Dockerfile.funding) and the
`trump-build-status` memory for the image + deployment details.

## Verified flow (2026-07-30)

The recipient's QR/link decodes to `https://contribute.trumpaccount.com/<user>-<id>/?secret=<token>` (a **non-expiring** link — capture once, reuse forever). Steps:

1. Landing → **Get started**
2. **Enter contribution amount**
3. **Add a message** — "Your name" (the gifter) + optional message
4. **Review** — shows Amount / To (account holder) / From / Message + an
   *"irrevocable contribution"* acknowledgment checkbox → **Continue to payment**
5. **Payment** — **DEBIT CARDS ONLY** (no credit/prepaid), via Stripe: email,
   card number/exp/CVC, billing address → **Pay now**

Today the worker drives to step 5 and **stops at the debit-card page** (no card
entered, nothing submitted).

## Usage

```bash
cd funding
npm install
npx playwright install chromium   # one-time
node src/run.mjs --url "https://contribute.trumpaccount.com/…/?secret=…" --amount 2500 --from "Grandma Jo" --message "For your future!"
```

Writes `payment-step.png` and prints the account-holder name it read from the
review step.

## Open decisions / notes

- **Runtime:** RESOLVED (2026-07-31) — a **container-image Lambda** (Playwright
  base `v1.62.1-jammy` + `aws-lambda-ric`, x86_64, 2048 MB, 1024 MB `/tmp`),
  SQS-triggered off the `trump-funding` FIFO queue. Deployed + verified launching
  Chromium in-Lambda. Chromium needs the hardened launch flags
  `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process --no-zygote`
  (without `--single-process/--no-zygote` a renderer crashes → CDP "Assertion
  error"). Debit-card SUBMIT still stops at the debit-card page (below).
- **Debit card handling:** the real card is supplied **at runtime only** (secure
  prompt / Secrets Manager) and passed to `contribute({ card })`. Never commit,
  log, or hard-code it. `fillDebitCard` is scaffolded but **UNTESTED** pending a
  real card.
- **Bot detection:** the payment step includes **hCaptcha / Stripe human-security**
  frames. Submitting via automation may trigger a challenge — needs handling (or
  a supervised/human-in-the-loop submit) before "Pay now" can be automated.
- **Name-match (D3) bonus:** the review step surfaces the account-holder name
  ("To"), so verification can be automated by reading it instead of a manual step.
