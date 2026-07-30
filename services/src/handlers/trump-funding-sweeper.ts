import { SQSClient } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { enqueueFunding } from "../funding/enqueue";

const repo = new Repo(requireEnv("TABLE_NAME"));
const sqs = new SQSClient({});
const QUEUE_URL = requireEnv("FUNDING_QUEUE_URL");

/**
 * Scheduled sweeper (EventBridge cron). Re-enqueues cards whose Trump-funding
 * scheduled retry is due, giving the worker another attempt after an outage.
 * Enqueue first, then clear the marker so a send failure just retries next sweep.
 */
export const handler = async (): Promise<void> => {
  const due = await repo.listFundingRetriesDue(new Date().toISOString());
  let ok = 0;
  for (const card of due) {
    try {
      await enqueueFunding(sqs, QUEUE_URL, card.cardId, "sweeper");
      await repo.saveCard({ ...card, trumpFundingRetryAt: undefined, updatedAt: new Date().toISOString() });
      ok++;
    } catch (e) {
      console.error("funding sweeper: re-enqueue failed", card.cardId, e);
    }
  }
  console.log(`funding sweeper: ${ok}/${due.length} due retries re-enqueued`);
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
