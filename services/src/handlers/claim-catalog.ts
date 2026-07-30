import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getGiftCardCatalog } from "../giftcards";
import { recipientDenominationCents } from "../giftcards/fees";
import { GiftCardLeg } from "../domain/states";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
type Ctx = { cardId: string };

/**
 * GET /claim/catalog — gift-card options for this card (§6.3, §7.2), grouped by
 * type. Filtered to products whose denomination range fits the gift amount. For
 * fee-bearing cash-out options, `netCents` is the reduced payout the recipient
 * actually receives (the platform's cost stays the gift amount). Empty for a
 * 100% split (giftCardLeg NONE). If the sender pinned products, only those show.
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;
  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.giftCardLeg === GiftCardLeg.NONE) return json(200, { products: [] });

  const budget = card.giftCardAmount;
  const catalog = await (await getGiftCardCatalog()).listCatalog();
  const allowed = card.allowedGiftCardProducts;

  const products = catalog
    .filter((p) => (allowed.length > 0 ? allowed.includes(p.id) : true))
    // The (fee-reduced) denomination must fall within the product's range.
    .filter((p) => {
      const net = recipientDenominationCents(p.category, budget);
      return (p.minCents === undefined || net >= p.minCents) && (p.maxCents === undefined || net <= p.maxCents);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      groupLabel: p.groupLabel,
      deliveryNote: p.deliveryNote,
      physical: p.physical,
      feeBearing: p.feeBearing,
      imageUrl: p.imageUrl,
      popular: p.popular,
      /** What the recipient receives (reduced by fee for cash-out). */
      netCents: recipientDenominationCents(p.category, budget),
    }));

  return json(200, { products, budgetCents: budget, senderPinned: allowed.length > 0 });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
