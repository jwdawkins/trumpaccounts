import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getGiftCardCatalog } from "../giftcards";
import { GiftCardLeg } from "../domain/states";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
type Ctx = { cardId: string };

/**
 * GET /claim/catalog — gift-card options for this card (§6.3, §7.2).
 * If the sender pinned specific products, only those are offered; otherwise the
 * full catalog (popular first). Empty when the card is a 100% split (NONE).
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;
  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.giftCardLeg === GiftCardLeg.NONE) return json(200, { products: [] });

  const catalog = await (await getGiftCardCatalog()).listCatalog();
  const allowed = card.allowedGiftCardProducts;
  const products = allowed.length > 0 ? catalog.filter((p) => allowed.includes(p.id)) : catalog;
  return json(200, { products, senderPinned: allowed.length > 0 });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
