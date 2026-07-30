import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

/**
 * Enqueue an async Trump-funding job for a card. FIFO per-card group so a card's
 * jobs stay ordered; the dedup id varies per enqueue so a fresh (re)trigger is
 * never dropped as a duplicate.
 */
export async function enqueueFunding(
  sqs: SQSClient,
  queueUrl: string,
  cardId: string,
  tag: string,
): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ cardId }),
      MessageGroupId: cardId,
      MessageDeduplicationId: `${cardId}:${tag}:${Date.now()}`,
    }),
  );
}
