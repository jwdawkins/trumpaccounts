import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getGiftCardCatalog } from "../giftcards";
import { json } from "./http";

/**
 * GET /catalog — public gift-card catalog for the storefront (§7.1). Buyers pin
 * products here, so the ids MUST be the same Tremendous product ids the recipient
 * later selects. Returns popular brands only by default (the storefront's pin
 * list); ?all=1 returns the full catalog.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const all = event.queryStringParameters?.all === "1";
  const catalog = await (await getGiftCardCatalog()).listCatalog();
  const products = all ? catalog : catalog.filter((p) => p.popular);
  return json(200, { products });
};
