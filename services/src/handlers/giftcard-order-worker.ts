import { SQSHandler } from "aws-lambda";
import { Repo } from "../data/repo";
import { getGiftCardOrderer } from "../giftcards";
import { placeGiftCardOrder } from "../fulfillment/order-giftcard";

const repo = new Repo(requireEnv("TABLE_NAME"));

/** Message shape enqueued by admin-fulfill-giftcard. */
interface GiftCardOrderJob {
  cardId: string;
  overrideEmail?: string;
}

/**
 * SQS-triggered async order worker (§6.3 — money movement is server-side, never
 * on a synchronous web path). Holds the ORDER key (via getGiftCardOrderer) which
 * no web-facing function is granted. Places the Tremendous reward order and
 * advances the card's gift-card leg. Partial-batch: a throwing (transient) record
 * is retried without reprocessing siblings; permanent 4xx failures are consumed
 * after marking the leg FAILED.
 */
export const handler: SQSHandler = async (event) => {
  const failures: { itemIdentifier: string }[] = [];
  const orderer = await getGiftCardOrderer();

  for (const record of event.Records) {
    try {
      const job = JSON.parse(record.body) as GiftCardOrderJob;
      if (!job.cardId) {
        console.warn("giftcard order job missing cardId", record.messageId);
        continue; // unrecoverable payload — drop
      }
      const outcome = await placeGiftCardOrder(repo, orderer, job.cardId, job.overrideEmail);
      console.log("giftcard order outcome", job.cardId, JSON.stringify(outcome));
    } catch (e) {
      console.error("giftcard order failed (will retry)", record.messageId, e);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
