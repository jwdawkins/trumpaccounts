\# Trump Account Gift Card Program — Design \& Handoff Document



\*\*Audience:\*\* Claude Code (implementation agent)

\*\*Owner:\*\* Jerry Dawkins (jerald.dawkins@dais.co)

\*\*Date:\*\* 2026-07-27

\*\*Status:\*\* Approved for build, with open items flagged in §9



\---



\## 1. Product Summary



A gift card platform where a buyer purchases a gift and splits the value between (a) a contribution to the recipient's \*\*Trump Account\*\* (the federal tax-advantaged child savings account created under the 2025 tax law) and (b) an optional retail gift card fulfilled via \*\*Tremendous\*\*. Three personas: \*\*Buyer\*\* (storefront + checkout + history), \*\*Recipient\*\* (claim link, gift card selection, Trump Account linking), \*\*Admin\*\* (dashboards, order management, manual operations).



\---



\## 2. Resolved Discrepancies \& Decisions



These issues were found in the source notes. Each has a resolution that governs implementation.



| # | Discrepancy in notes | Resolution |

|---|---|---|

| D1 | 1.1.6 says login optional; 1.1.8 says account required to checkout | \*\*Both, sequenced.\*\* Browsing and cart-building require no login. An account (lightweight Cognito email + one-time code) is created/entered \*at\* checkout, never before. Do not gate the flow behind a login wall. |

| D2 | Purchase fields (1.1.7) never capture recipient email/phone, but delivery is via email/SMS (1.1.9.1) | Add per-card delivery step: buyer provides \*\*email, mobile number, or chooses "I'll share it myself"\*\* (generates copyable link + printable PDF gift certificate with QR). |

| D3 | Recipient name is optional (1.1.7.3), but the Unverified status depends on a name match | Rule: \*\*if buyer provided a name → name match required\*\* (mismatch → `UNVERIFIED`, buyer decides allow/disallow). \*\*If no name provided → name check skipped\*\*; verification passes on any successfully linked Trump Account. Buyer is notified of the linked name either way. Make the skip behavior a config flag (`REQUIRE\\\_NAME\\\_MATCH\\\_WHEN\\\_ABSENT=false`). |

| D4 | Two conflicting status vocabularies: buyer-side (Open/Pending/Complete/Unverified) vs recipient-side (Gift card selected / Trump Account Verified / Funds Transferred) | \*\*One canonical state machine\*\* (§4) with per-persona display mappings. Recipient sees a 3-step progress checklist derived from the fulfillment legs; buyer sees the 4 summary statuses. |

| D5 | Fulfillment has \*\*two independent legs\*\* (Tremendous gift card + Trump Account transfer) that complete at different times; a single "Complete" can't represent this. Also, at 100% Trump allocation there is no gift card leg at all, but 1.2.2 assumes the recipient always picks a card | Track two leg sub-states on each card (§4.2). `COMPLETE` = both legs terminal-success (gift card leg may be `NONE`). Recipient claim flow skips card selection when allocation is 100%. |

| D6 | "Pending" is overloaded: link clicked awaiting verification (1.1.8.1.2) vs account created but no Trump Account yet (1.2.7) | Two internal states — `CLAIMED` and `AWAITING\\\_TRUMP\\\_ACCOUNT` — both displayed to the buyer as \*\*Pending\*\*. |

| D7 | Missing lifecycle states: what happens on regenerate (voided card), never-claimed cards, refunds | Added `VOIDED`, `EXPIRED` (optional TTL, default off), `REFUNDED` as terminal states, plus full audit trail of mismatch allow/disallow decisions. |

| D8 | QR flow underspecified: what the Trump Account QR encodes, and texting a QR requires inbound MMS + decoding | Treat QR content as \*\*opaque provider payload\*\* handled by the TrumpAccountProvider adapter (§6.1). Support (a) in-page upload and (b) inbound MMS to a Twilio number; decode server-side (zbar/jsQR in Lambda). Exact payload spec is Open Item O1. |

| D9 | 1.2.4 "if they login you can link their card with their Trump Account" — logging into \*our\* app doesn't link anything by itself | Login (optional Cognito account for recipient) only persists identity and claim history. Actual linking always goes through the adapter: QR upload, MMS, or provider OAuth if one ever exists. |

| D10 | 1.3.4 says "all open orders" but then filters across all four statuses | Read as \*\*all orders\*\*, filterable by any status, with buyer + recipient names, amounts, split, dates. |

| D11 | Regenerate is only defined from Open (1.1.8.1.1.1); cards can get stuck in Pending (e.g., recipient abandons) | Buyer regenerate: `OPEN` only. \*\*Admin\*\* can void/regenerate/resend from any non-terminal state (§7.3). |

| D12 | Money movement is undefined: where funds sit between Stripe payment and disbursement; how Tremendous is funded; unclaimed funds | Flagged legal/compliance items in §9 — do not silently solve in code. MVP: funds settle to platform Stripe balance; Tremendous funded from prefunded balance; Trump transfers executed via manual ops queue (adapter). |



Additional suggestions incorporated: idempotency on all payment/fulfillment mutations, immutable audit log via DynamoDB Streams → Firehose → S3 Object Lock (AWS QLDB is deprecated — do not use), claim-token security (§8), unclaimed-card reminder schedule, Trump Account annual contribution limit disclosure ($5,000/yr, indexed — we cannot verify other contributors, so disclose rather than enforce; warn if a single buyer's yearly total to one recipient exceeds it).



\---



\## 3. Architecture



\- \*\*Compute:\*\* AWS Lambda (Node 20, TypeScript). \*\*One Lambda per logical handler\*\* — small cold starts, tightly scoped IAM. No monolith.

\- \*\*API:\*\* API Gateway HTTP API. Cognito JWT authorizer for buyer/admin routes; claim-token auth (custom Lambda authorizer) for recipient routes.

\- \*\*Data:\*\* DynamoDB single-table (§5). No relational DB.

\- \*\*Immutable audit log:\*\* every state transition and activity emitted as an event → DynamoDB Streams → Kinesis Firehose → \*\*S3 bucket with Object Lock (compliance mode)\*\*, partitioned by date. This is the source of truth for forensics; DynamoDB holds current state.

\- \*\*Async layer:\*\* EventBridge bus for domain events; \*\*Step Functions\*\* for the fulfillment saga (Tremendous order, Trump transfer, retries/backoff, DLQ on failure); SQS buffering for inbound webhooks; \*\*EventBridge Scheduler\*\* for reminders (unclaimed card nudges at day 3, 7, 30) and link expiry (if enabled).

\- \*\*Auth:\*\* Amazon Cognito. One user pool; groups: `buyers` (default), `admins`. Email + one-time-code signup (passwordless if feasible; otherwise minimal password flow). Recipients never need Cognito unless they opt in.

\- \*\*Frontend:\*\* Single React SPA (Vite + TypeScript + Tailwind) on S3 + CloudFront. Route groups: `/` (buyer storefront), `/claim/:token` (recipient), `/admin` (admin, Cognito-group-gated).

\- \*\*IaC:\*\* AWS CDK (TypeScript). One stack per concern (data, api, web, async).

\- \*\*Notifications:\*\* SES (email), Twilio (outbound SMS + inbound MMS for QR texting).

\- \*\*Observability:\*\* CloudWatch structured JSON logs, X-Ray tracing on Step Functions and Lambdas, alarms on DLQ depth and webhook failure rate.



\---



\## 4. Canonical State Machine



\### 4.1 Card top-level states



```

PENDING\\\_PAYMENT → OPEN → CLAIMED → COMPLETE

\&#x20;                   │        ├→ AWAITING\\\_TRUMP\\\_ACCOUNT → (back to CLAIMED path)

\&#x20;                   │        └→ UNVERIFIED ─ allow → COMPLETE (after transfer)

\&#x20;                   │                       └ disallow → OPEN

\&#x20;                   ├→ VOIDED   (buyer regenerate, or admin void)

\&#x20;                   ├→ EXPIRED  (optional TTL; off by default)

\&#x20;                   └→ REFUNDED (admin-initiated)

```



| State | Meaning | Buyer sees | Entry |

|---|---|---|---|

| `PENDING\\\_PAYMENT` | Checkout started; Stripe not confirmed | (not shown) | Order created |

| `OPEN` | Paid; claim link issued/delivered; not claimed | \*\*Open\*\* | Stripe `payment\\\_intent.succeeded` |

| `CLAIMED` | Recipient opened link and completed selection; verification/fulfillment in progress | \*\*Pending\*\* | Recipient completes claim step |

| `AWAITING\\\_TRUMP\\\_ACCOUNT` | Claimed, but recipient has no active Trump Account yet. Link is consumed — cannot be claimed by anyone else | \*\*Pending\*\* | Recipient indicates no account / linking incomplete |

| `UNVERIFIED` | Name mismatch between buyer-supplied name and linked Trump Account | \*\*Unverified\*\* — with Allow / Disallow actions | Verification name check fails |

| `COMPLETE` | All applicable legs done: Trump funds transferred (+ gift card delivered if applicable) | \*\*Complete\*\* | Both legs terminal-success |

| `VOIDED` | Superseded by regeneration or admin void | Voided (in history) | Buyer regenerate (from OPEN) or admin action |

| `EXPIRED` | Link TTL elapsed (feature-flagged, default off) | Expired | Scheduler |

| `REFUNDED` | Payment refunded to buyer | Refunded | Admin action (Stripe refund) |



Mismatch decisions: \*\*allow\*\* → proceed to transfer → `COMPLETE`; \*\*disallow\*\* → card returns to `OPEN` with the prior claim invalidated (new claim allowed; optionally auto-regenerate token).



\### 4.2 Fulfillment legs (attributes on the card, drive recipient progress UI)



\- `giftCardLeg`: `NONE` (100% Trump split) | `AWAITING\\\_SELECTION` | `SELECTED` | `ORDERED` | `DELIVERED` | `FAILED`

\- `trumpLeg`: `UNLINKED` | `LINKED` | `PENDING\\\_VERIFICATION` | `VERIFIED` | `MISMATCH` | `TRANSFER\\\_INITIATED` | `TRANSFERRED` | `FAILED`



`COMPLETE` ⇔ `giftCardLeg ∈ {NONE, DELIVERED}` AND `trumpLeg = TRANSFERRED`.



\*\*Recipient status page checklist\*\* (1.2.6): ① Gift card selected → `giftCardLeg ≥ SELECTED` (hidden when `NONE`); ② Trump Account verified → `trumpLeg ≥ VERIFIED`; ③ Funds transferred → `trumpLeg = TRANSFERRED`.



Every transition writes an immutable event: `{eventId, cardId, orderId, actor, from, to, leg?, reason?, timestamp, requestId}`.



\---



\## 5. Data Model (DynamoDB single-table: `gift-platform`)



| Entity | PK | SK | Notes |

|---|---|---|---|

| User | `USER#<userId>` | `PROFILE` | Cognito sub, email, name, createdAt |

| Order | `ORDER#<orderId>` | `META` | buyerId, stripePaymentIntentId, totalAmount, status, createdAt |

| Gift Card | `ORDER#<orderId>` | `CARD#<cardId>` | Full card record (see below) |

| Card by ID | `CARD#<cardId>` | `META` | Denormalized pointer or use GSI |

| Verified Recipient | `USER#<buyerId>` | `RECIP#<recipientId>` | Saved after a card completes; enables "send again" (1.1.8.2) |

| Claim token | `TOKEN#<sha256(token)>` | `META` | → cardId. Only the \*\*hash\*\* is stored |

| Event (mirror) | `CARD#<cardId>` | `EVT#<ts>#<eventId>` | Also streamed to S3 Object Lock |



\*\*Card record fields:\*\* cardId, orderId, buyerId, totalAmount, trumpPercent (`10|25|50|100`), trumpAmount, giftCardAmount, allowedGiftCardProducts\[] (Tremendous product IDs; empty = recipient's choice), selectedGiftCardProduct, recipientName?, message?, deliveryMethod (`EMAIL|SMS|SELF`), recipientEmail?, recipientPhone?, state, giftCardLeg, trumpLeg, claimTokenHash, claimedAt?, linkedTrumpAccountRef?, mismatchDecision?, tremendousOrderId?, trumpTransferRef?, timestamps.



\*\*GSIs:\*\*

\- `GSI1` byBuyer: `buyerId` / `createdAt` — buyer history.

\- `GSI2` byState: `state` / `createdAt` — admin filters and dashboards.

\- `GSI3` byToken: `claimTokenHash` — claim resolution (or use the TOKEN item above; pick one).



Monetary values stored as \*\*integer cents\*\*. No floats anywhere.



\---



\## 6. Integrations



\### 6.1 TrumpAccountProvider (adapter — the critical abstraction)



There is \*\*no public Trump Account API today\*\*. All Trump Account interaction goes through one interface so the transport can be swapped without touching business logic:



```ts

interface TrumpAccountProvider {

\&#x20; parseLinkPayload(input: QrUpload | MmsMedia | ManualEntry): Promise<AccountRef>;

\&#x20; verifyAccount(ref: AccountRef): Promise<{ status: 'VERIFIED'|'NOT\\\_FOUND'|'INACTIVE'; accountHolderName?: string }>;

\&#x20; initiateTransfer(ref: AccountRef, amountCents: number, idempotencyKey: string): Promise<{ transferRef: string }>;

\&#x20; getTransferStatus(transferRef: string): Promise<'PENDING'|'SETTLED'|'FAILED'>;

}

```



\*\*MVP implementation: `ManualOpsProvider`\*\* — verification and transfers land in an admin work queue; an admin performs the action out-of-band (e.g., ACH) and records the outcome (name seen, transfer confirmation #) in the admin portal, which advances the state machine. Decoded QR payloads are stored for the ops team. A future `PartnerApiProvider` implements the same interface.



\### 6.2 Stripe (payments)



Stripe Checkout Session per order (N cards per order). Webhooks (`checkout.session.completed`, `payment\\\_intent.succeeded`, `charge.refunded`) → SQS → handler; verify signatures; idempotent by event ID. On payment success: cards → `OPEN`, claim tokens generated, delivery notifications dispatched (or PDF/link surfaced for `SELF`).



\### 6.3 Tremendous (gift cards)



Catalog: fetch products, cache 24h; storefront pins \*\*Starbucks, Amazon, Prepaid Visa\*\* first (config list). Buyer selects 1+ allowed products or "recipient's choice." On recipient selection + verification gates passing, Step Functions places the Tremendous order (idempotency key = cardId+leg) and tracks delivery via webhook/polling. Funding: prefunded Tremendous balance (MVP); alarm when balance < configurable floor.



\*\*Ordering rule (decision):\*\* the gift card leg is \*\*not ordered until the Trump leg reaches `VERIFIED`\*\* (or the buyer allows a mismatch, or name check is skipped per D3). This prevents the gift card being consumed while the Trump leg later fails/disallows. If Jerry wants instant gift-card gratification instead, flip config `ORDER\\\_GIFTCARD\\\_BEFORE\\\_VERIFY=true` — but the disallow path then can't claw it back.



\### 6.4 Notifications



\- Email: SES templated (claim invite, reminders, status changes, buyer mismatch alert, completion receipts).

\- SMS: Twilio (claim invite, status). Inbound MMS number for QR texting: MMS → S3 → decode → match to card by phone number + most-recent unlinked claim; ambiguity → reply asking recipient to use the link instead.

\- \*\*Printable PDF\*\* (`SELF` delivery): Lambda-generated gift certificate (amount, message, QR of claim URL, redemption instructions).



\---



\## 7. Personas \& Screens



\### 7.1 Buyer (`/`)



1\. \*\*Storefront/cart\*\* — no login. Add any number of gift cards; per card: total amount; Trump split (10/25/50/100%); if <100%, pick 1+ gift card options (popular first: Starbucks, Amazon, Prepaid Visa) or "let recipient choose"; recipient name (optional, drives verification per D3); message (optional); delivery (email / SMS / share myself).

2\. \*\*Checkout\*\* — inline account create/sign-in (email + code), then Stripe Checkout redirect. Returning buyers see \*\*verified past recipients\*\* for one-click resend (1.1.8.2).

3\. \*\*History\*\* — orders/cards with buyer-facing statuses (Open, Pending, Complete, Unverified, plus Voided/Refunded/Expired). Actions: \*\*Regenerate\*\* (OPEN only; voids old card + token, issues new, redelivers, confirmation modal), \*\*Allow/Disallow\*\* on UNVERIFIED (shows buyer-entered name vs account-holder name).



\### 7.2 Recipient (`/claim/:token`) — no account required



1\. Landing: gift details (from name, message, amounts).

2\. Gift card selection (skipped at 100% split): sender-pinned option(s) — exactly one selectable — or full catalog with popular-first.

3\. Trump Account linking: \*\*(a)\*\* upload QR photo, \*\*(b)\*\* text QR to displayed number, \*\*(c)\*\* optional sign-in to save progress/history. Prominent "Don't have a Trump Account?" panel → where to open one (config content, Open Item O2) → card sits in `AWAITING\\\_TRUMP\\\_ACCOUNT`; link stays consumed and revisitable.

4\. Status page (revisit link anytime): 3-step checklist per §4.2.



\### 7.3 Admin (`/admin`, Cognito `admins` group)



1\. \*\*Dashboard\*\* — counts + dollar values for Open / Pending / Completed / Unverified; range selector: Today, 1 Week, Month, Quarter, YTD, All Time.

2\. \*\*Orders/cards table\*\* — all orders, filter by status, search by buyer/recipient name, full detail drill-in (both legs, event timeline from audit log).

3\. \*\*Ops queue\*\* (ManualOpsProvider) — pending verifications (decoded QR payload, buyer-entered name → record verified name) and pending transfers (mark initiated/settled with reference #).

4\. \*\*Actions\*\* — resend notification, void, regenerate (any non-terminal state), refund (drives Stripe refund → `REFUNDED`).



\---



\## 8. Security \& Non-Functional Requirements



\- Claim tokens: ≥128-bit random (e.g., 26+ char base32), \*\*stored hashed (SHA-256)\*\*, never logged; regeneration invalidates old hash immediately.

\- Claim endpoints rate-limited (API Gateway throttling + WAF); token brute-force alarms.

\- No PII in URLs beyond the opaque token; no card amounts in notification subject lines.

\- All mutating endpoints idempotent (client-supplied idempotency keys on checkout; event-ID dedupe on webhooks; cardId-scoped keys in the saga).

\- Least-privilege IAM per Lambda; secrets in AWS Secrets Manager (Stripe, Tremendous, Twilio keys).

\- Audit S3 bucket: Object Lock compliance mode, no delete permissions in any app role.

\- PII (names, emails, phones, QR payloads) encrypted at rest (DDB default + KMS CMK for QR payload blobs in S3); QR images deleted after decode + configurable retention.

\- Admin routes require Cognito `admins` group \*\*and\*\* are served under `/admin` with its own authorizer — never trust the SPA alone.



\---



\## 9. Open Items (require Jerry / legal — do NOT resolve in code)



| # | Item | Interim behavior |

|---|---|---|

| O1 | Trump Account QR payload format and the actual transfer rail (partner? ACH instructions? provider TBD) | `ManualOpsProvider`; store raw decoded payload for ops |

| O2 | "Where to open a Trump Account" content/links for recipients | CMS-style config string |

| O3 | \*\*Money transmission licensing\*\* — platform holds funds between payment and disbursement. Needs counsel; may dictate Stripe Connect/Treasury or a bank partner | Funds remain in Stripe balance; no interest-bearing hold; keep claim-to-disbursement window short |

| O4 | Unclaimed funds policy (refund after N days? escheatment?) | Reminders at 3/7/30 days; no auto-action; admin refund tool exists |

| O5 | Trump Account $5,000/yr contribution limit (indexed) — unverifiable across contributors | Disclosure at checkout; soft warn if one buyer exceeds limit to one recipient in a calendar year |

| O6 | Fees: platform fee? who absorbs Stripe fees? | MVP: buyer pays face value; fees absorbed; line-item structure kept flexible in order model |

| O7 | Link expiry TTL on/off and duration | Feature flag, default off |

| O8 | Branding/legal review of product name and any Tremendous card terms | n/a |



\---



\## 10. Build Order for Claude Code



1\. \*\*M1 — Foundation:\*\* CDK stacks; DynamoDB table + GSIs; event/audit pipeline (Streams → Firehose → S3 Object Lock); Cognito pool + groups; SPA skeleton with three route groups; CI (typecheck, vitest, cdk synth).

2\. \*\*M2 — Buyer \& payments:\*\* cart/checkout UI; order + card creation; Stripe Checkout + webhooks; claim token issuance; email/SMS/PDF delivery; buyer history (read-only).

3\. \*\*M3 — Recipient claim:\*\* claim landing + token authorizer; Tremendous catalog + selection; QR upload + inbound MMS decode; `AWAITING\\\_TRUMP\\\_ACCOUNT` path; status page.

4\. \*\*M4 — Verification \& fulfillment:\*\* TrumpAccountProvider interface + ManualOpsProvider; Step Functions saga; name-match logic (D3); UNVERIFIED allow/disallow; Tremendous ordering gated per §6.3; COMPLETE convergence.

5\. \*\*M5 — Admin portal:\*\* dashboard aggregates (range queries on GSI2), orders table + filters, ops queue, admin actions.

6\. \*\*M6 — Hardening:\*\* reminders/scheduler, regenerate flows, refunds, WAF/rate limits, alarms, load test of claim path, full state-machine test suite (every transition in §4, including disallow → OPEN and regenerate → VOIDED).



\*\*Testing bar:\*\* unit tests for the state machine (exhaustive transition table — invalid transitions must throw), webhook idempotency tests, and an integration test per persona happy-path plus the mismatch and no-Trump-Account paths.



\---



\## 11. Traceability



All source note items 1.1.1–1.3.4 are covered: architecture (§3), buyer flow 1.1.6–1.1.9 (§7.1, §4, §6.2), recipient flow 1.2.1–1.2.7 (§7.2, §4.2, §6.1), admin 1.3.1–1.3.4 (§7.3). Deviations from the notes are exactly the twelve decisions in §2.

