import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { SQSClient } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { getGiftCardCatalog } from "../giftcards";
import { GiftCardLeg } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { enqueueGiftCardOrderIfReady } from "../fulfillment/enqueue-giftcard";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const sqs = new SQSClient({});
const GIFTCARD_QUEUE_URL = requireEnv("GIFTCARD_QUEUE_URL");
type Ctx = { cardId: string };

/**
 * POST /claim/select { productId } — recipient picks a gift card (§7.2).
 * Validates against the sender's allowed list (or the full catalog if the
 * sender left it to the recipient), then sets giftCardLeg = SELECTED.
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;

  let productId: string;
  try {
    productId = JSON.parse(event.body ?? "{}").productId;
    if (!productId) return json(400, { message: "productId is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.giftCardLeg === GiftCardLeg.NONE) {
    return json(409, { message: "this gift has no gift-card portion" });
  }

  const catalog = await (await getGiftCardCatalog()).listCatalog();
  const allowed = card.allowedGiftCardProducts;
  const product = catalog.find((p) => p.id === productId);
  const isValid = !!product && (allowed.length === 0 || allowed.includes(productId));
  if (!isValid) return json(400, { message: "invalid product selection" });

  const now = new Date().toISOString();
  const updated = {
    ...card,
    selectedGiftCardProduct: productId,
    selectedGiftCardCategory: product.category,
    giftCardLeg: GiftCardLeg.SELECTED,
    updatedAt: now,
  };
  await repo.saveCard(updated);
  await repo.appendEvent({
    eventId: newEventId(),
    cardId,
    orderId: card.orderId,
    actor: "recipient",
    leg: "giftCard",
    reason: `selected ${productId}`,
    timestamp: now,
  });

  // If the Trump leg is already verified, auto-order the gift card now (§6.3).
  // Best-effort: a failure here doesn't block the selection response.
  try {
    await enqueueGiftCardOrderIfReady(repo, sqs, GIFTCARD_QUEUE_URL, updated, "system:auto-fulfill");
  } catch (e) {
    console.error("auto gift-card enqueue failed (will remain SELECTED)", cardId, e);
  }

  return json(200, { ok: true, selectedGiftCardProduct: productId });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
