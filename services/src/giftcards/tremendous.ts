import {
  GiftCardProvider,
  GiftCardProduct,
  CreateGiftCardOrder,
  GiftCardOrderResult,
} from "./provider";

export type TremendousEnvironment = "sandbox" | "production";

export interface TremendousConfig {
  apiKey: string;
  environment: TremendousEnvironment;
  /** Funding source id, or a magic value (BALANCE | INVOICE | INVOICE_THEN_BALANCE). */
  fundingSourceId: string;
}

const BASE_URL: Record<TremendousEnvironment, string> = {
  sandbox: "https://testflight.tremendous.com/api/v2",
  production: "https://www.tremendous.com/api/v2",
};

/**
 * Brands pinned to the top of the storefront/claim catalog (§7.1). Matched
 * case-insensitively against the Tremendous product name — Tremendous product
 * ids are opaque, so we key on the human name.
 */
const POPULAR_BRANDS = ["amazon", "starbucks", "visa", "target", "walmart", "doordash"];

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24h (§6.3)

// Raw Tremendous shapes (only the fields we consume).
interface TremProduct {
  id: string;
  name: string;
  category?: string;
  skus?: { min?: number; max?: number }[];
  images?: { src?: string; type?: string }[];
}
interface TremReward {
  id?: string;
  delivery?: { method?: string; status?: string; link?: string };
}
interface TremOrder {
  id: string;
  status: string;
  rewards?: TremReward[];
}

/**
 * Tremendous-backed gift-card provider (handoff §6.3). Catalog from GET /products,
 * ordering via POST /orders. Single-product rewards resolve synchronously; for
 * LINK delivery the redemption URL is read back from the created reward.
 * The API key + funding source come from Secrets Manager, never from code/chat.
 */
export class TremendousGiftCardProvider implements GiftCardProvider {
  private readonly baseUrl: string;
  private catalogCache?: { at: number; products: GiftCardProduct[] };

  constructor(private readonly cfg: TremendousConfig) {
    this.baseUrl = BASE_URL[cfg.environment];
  }

  async listCatalog(): Promise<GiftCardProduct[]> {
    const now = Date.now();
    if (this.catalogCache && now - this.catalogCache.at < CATALOG_TTL_MS) {
      return this.catalogCache.products;
    }
    const body = await this.request<{ products: TremProduct[] }>(
      "GET",
      "/products?country=US&currency=USD",
    );
    const products = (body.products ?? [])
      .map((p) => toProduct(p))
      .sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name));
    this.catalogCache = { at: now, products };
    return products;
  }

  async createOrder(order: CreateGiftCardOrder): Promise<GiftCardOrderResult> {
    const recipient: Record<string, string> = { name: order.recipientName || "Gift recipient" };
    // Tremendous requires an email for EMAIL delivery; for LINK it is optional.
    if (order.recipientEmail) recipient.email = order.recipientEmail;

    const payload = {
      external_id: order.externalId, // idempotency
      payment: { funding_source_id: this.cfg.fundingSourceId },
      reward: {
        value: { denomination: order.amountCents / 100, currency_code: "USD" },
        products: [order.productId],
        delivery: { method: order.delivery },
        recipient,
      },
    };

    const { order: created } = await this.request<{ order: TremOrder }>("POST", "/orders", payload);
    const reward = created.rewards?.[0];
    let link = reward?.delivery?.link;

    // For LINK delivery the URL may not be inlined on the create response; read it back.
    if (order.delivery === "LINK" && !link && reward?.id) {
      link = await this.getRewardLink(reward.id);
    }

    return { orderId: created.id, rewardId: reward?.id, status: created.status, link };
  }

  private async getRewardLink(rewardId: string): Promise<string | undefined> {
    const { reward } = await this.request<{ reward: TremReward }>("GET", `/rewards/${rewardId}`);
    return reward?.delivery?.link;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      // Surface Tremendous's error message without leaking the key.
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { errors?: { message?: string }; message?: string };
        detail = parsed.errors?.message ?? parsed.message ?? text;
      } catch {
        /* keep raw text */
      }
      throw new TremendousError(res.status, `Tremendous ${method} ${path} → ${res.status}: ${detail}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }
}

/** Non-2xx response from Tremendous. */
export class TremendousError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TremendousError";
  }
}

function toProduct(p: TremProduct): GiftCardProduct {
  const mins = (p.skus ?? []).map((s) => s.min).filter((n): n is number => typeof n === "number");
  const maxes = (p.skus ?? []).map((s) => s.max).filter((n): n is number => typeof n === "number");
  const nameLower = p.name.toLowerCase();
  return {
    id: p.id,
    name: p.name,
    popular: POPULAR_BRANDS.some((b) => nameLower.includes(b)),
    category: p.category,
    minCents: mins.length ? Math.round(Math.min(...mins) * 100) : undefined,
    maxCents: maxes.length ? Math.round(Math.max(...maxes) * 100) : undefined,
    imageUrl: p.images?.find((i) => i.src)?.src,
  };
}
