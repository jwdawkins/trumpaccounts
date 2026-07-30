import { SQSHandler } from "aws-lambda";
import { SQSClient } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { getTrumpFundingProvider } from "../funding";
import { runTrumpFunding, scheduleFundingRetry } from "../funding/run-funding";
import { enqueueGiftCardOrderIfReady } from "../fulfillment/enqueue-giftcard";

const repo = new Repo(requireEnv("TABLE_NAME"));
const sqs = new SQSClient({});
const GIFTCARD_QUEUE_URL = requireEnv("GIFTCARD_QUEUE_URL");

const QUICK_MAX = 3; // fast in-queue retries before switching to scheduled retries
const LONG_MAX = 24; // scheduled retries (~hourly) before giving up (~24h)
const RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour between scheduled retries

/**
 * Async Trump-Account funding worker (SQS-triggered). Auto-verifies + contributes
 * via runTrumpFunding. Retry policy for a transient/outage failure (§ "resubmit
 * after a time period"): the first QUICK_MAX deliveries retry fast via SQS
 * redelivery; after that we stop throwing and record a scheduled retry (~hourly,
 * up to LONG_MAX) that the sweeper re-enqueues, then give up as FAILED.
 */
export const handler: SQSHandler = async (event) => {
  const failures: { itemIdentifier: string }[] = [];
  const provider = await getTrumpFundingProvider();

  for (const record of event.Records) {
    let cardId: string | undefined;
    try {
      cardId = JSON.parse(record.body).cardId;
    } catch {
      console.warn("funding job: bad body", record.messageId);
      continue; // poison payload — drop
    }
    if (!cardId) {
      console.warn("funding job: missing cardId", record.messageId);
      continue;
    }

    const attempt = Number(record.attributes?.ApproximateReceiveCount ?? "1");
    try {
      const outcome = await runTrumpFunding(repo, provider, cardId);
      console.log("funding outcome", cardId, JSON.stringify(outcome));
      // Trump leg is now verified/transferred — auto-order the gift card if the
      // recipient already selected one (§6.3). Best-effort.
      if (outcome.status === "transferred") {
        const card = await repo.getCard(cardId);
        if (card) {
          const r = await enqueueGiftCardOrderIfReady(repo, sqs, GIFTCARD_QUEUE_URL, card, "system:auto-fulfill");
          console.log("auto gift-card enqueue after funding", cardId, r);
        }
      }
    } catch (e) {
      if (attempt < QUICK_MAX) {
        console.warn("funding transient failure — quick retry", cardId, "attempt", attempt, e);
        failures.push({ itemIdentifier: record.messageId }); // SQS redelivers
      } else {
        const res = await scheduleFundingRetry(repo, cardId, RETRY_DELAY_MS, LONG_MAX);
        console.warn("funding transient failure — scheduled retry", cardId, res, e);
        // consumed: the sweeper re-enqueues when due (or it was marked FAILED)
      }
    }
  }

  return { batchItemFailures: failures };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
