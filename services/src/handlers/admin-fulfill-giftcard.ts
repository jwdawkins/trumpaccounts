import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { GiftCardLeg } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { trumpLegAllowsOrdering } from "../fulfillment/order-giftcard";
import { json } from "./http";
import { requireAdmin } from "./admin-helpers";

const repo = new Repo(requireEnv("TABLE_NAME"));
const sqs = new SQSClient({});
const QUEUE_URL = requireEnv("GIFTCARD_QUEUE_URL");
const ORDER_BEFORE_VERIFY = process.env.ORDER_GIFTCARD_BEFORE_VERIFY === "true";

/**
 * POST /admin/cards/{cardId}/fulfill-giftcard — ENQUEUE the gift-card order.
 * Money never moves on this synchronous path (§6.3): this handler validates the
 * gating, marks the leg ORDERED, and hands the job to the async order-worker
 * (which alone holds the Tremendous order key). Returns 202. Retryable from a
 * previous FAILED. Optional body { recipientEmail } supplies an email for
 * SMS/SELF cards so the worker can deliver via EMAIL.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const admin = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
  if (!admin) return json(403, { message: "admin only" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  let overrideEmail: string | undefined;
  if (event.body) {
    try {
      overrideEmail = JSON.parse(event.body).recipientEmail || undefined;
    } catch {
      return json(400, { message: "invalid JSON body" });
    }
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.giftCardLeg === GiftCardLeg.NONE) {
    return json(409, { message: "this gift has no gift-card portion" });
  }
  if (card.giftCardLeg === GiftCardLeg.DELIVERED || card.tremendousOrderId) {
    return json(409, { message: "gift card already fulfilled", tremendousOrderId: card.tremendousOrderId });
  }
  if (card.giftCardLeg === GiftCardLeg.ORDERED) {
    return json(409, { message: "gift card order already in progress" });
  }
  // SELECTED (first attempt) or FAILED (retry) may be (re)enqueued.
  if (card.giftCardLeg !== GiftCardLeg.SELECTED && card.giftCardLeg !== GiftCardLeg.FAILED) {
    return json(409, { message: `gift card not ready to fulfill (giftCardLeg ${card.giftCardLeg})` });
  }
  if (!card.selectedGiftCardProduct) {
    return json(409, { message: "no gift card product selected" });
  }
  if (!ORDER_BEFORE_VERIFY && !trumpLegAllowsOrdering(card.trumpLeg)) {
    return json(409, { message: "Trump leg must be VERIFIED before ordering the gift card (§6.3)" });
  }

  const now = new Date().toISOString();
  const actor = `admin:${admin.adminId}`;

  // Mark ORDERED first so a double-click / concurrent call is rejected above.
  await repo.saveCard({ ...card, giftCardLeg: GiftCardLeg.ORDERED, updatedAt: now });
  await repo.appendEvent({
    eventId: newEventId(), cardId, orderId: card.orderId, actor,
    leg: "giftCard", reason: "gift card order enqueued", timestamp: now,
  });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ cardId, overrideEmail }),
      MessageGroupId: cardId, // per-card ordering
      MessageDeduplicationId: `${cardId}:${now}`, // distinct per (re)enqueue so retries aren't dropped
    }),
  );

  return json(202, { giftCardLeg: GiftCardLeg.ORDERED, state: card.state, message: "order enqueued" });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
