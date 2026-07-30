import { GiftCardCatalog, GiftCardOrderer } from "./provider";
import { StubGiftCardProvider } from "./stub";
import { TremendousGiftCardProvider } from "./tremendous";
import { getTremendousSecret } from "../config/secrets";

export * from "./provider";

/** ARN of the READ-ONLY catalog key — web/claim/storefront paths only. */
const CATALOG_ARN = process.env.TREMENDOUS_CATALOG_SECRET_ARN;
/** ARN of the ORDER key — the async order-worker only. */
const ORDERS_ARN = process.env.TREMENDOUS_ORDERS_SECRET_ARN;

let catalogProvider: Promise<GiftCardCatalog> | undefined;
let ordererProvider: Promise<GiftCardOrderer> | undefined;

/**
 * Read-only catalog provider (safe for synchronous web paths). Uses the catalog
 * key when configured, else the stub. Never capable of moving money.
 */
export function getGiftCardCatalog(): Promise<GiftCardCatalog> {
  if (!catalogProvider) catalogProvider = build(CATALOG_ARN);
  return catalogProvider;
}

/**
 * Order provider (money-moving). Only the async order-worker calls this, and
 * only it is granted the order secret. Uses the order key when configured, else
 * the stub (so offline/dev still exercises the pipeline).
 */
export function getGiftCardOrderer(): Promise<GiftCardOrderer> {
  if (!ordererProvider) ordererProvider = build(ORDERS_ARN);
  return ordererProvider;
}

async function build(arn: string | undefined): Promise<TremendousGiftCardProvider | StubGiftCardProvider> {
  if (!arn) return new StubGiftCardProvider();
  const secret = await getTremendousSecret(arn);
  if (!secret) {
    console.warn("Tremendous key not configured; using stub gift-card provider");
    return new StubGiftCardProvider();
  }
  return new TremendousGiftCardProvider(secret);
}
