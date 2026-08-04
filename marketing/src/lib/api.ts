import { config } from "../config";
import { fetchAuthSession } from "aws-amplify/auth";

/** Any whole percent 1–100 (the backend validates the range). */
export type TrumpPercent = number;
export type DeliveryMethod = "EMAIL" | "SMS" | "SELF";
export type VerificationMode = "OPEN" | "VERIFIED";

/**
 * What the configurator's "Add to Cart" produces — the gift *definition* only.
 * Recipient / delivery / verification are gathered later, at checkout, and
 * merged in to form a full `CartItemInput`.
 */
export interface GiftDraft {
  totalAmount: number; // cents
  trumpPercent: TrumpPercent;
  /** Selected gift-card product id(s); empty at 100% Trump (no spendable leg). */
  allowedGiftCardProducts: string[];
  /** Display-only brand name for the cart/checkout UI. */
  brandName?: string;
  /** Optional gift message (e.g. pre-filled from an occasion). */
  message?: string;
  /** Recipient details, collected in the builder wizard. */
  verificationMode?: VerificationMode;
  deliveryMethod?: DeliveryMethod;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
}

/** The full order line sent to POST /orders (draft + recipient details). */
export interface CartItemInput {
  totalAmount: number; // cents
  trumpPercent: TrumpPercent;
  allowedGiftCardProducts?: string[];
  brandName?: string;
  verificationMode: VerificationMode;
  recipientName?: string;
  message?: string;
  deliveryMethod: DeliveryMethod;
  recipientEmail?: string;
  recipientPhone?: string;
}

export interface CreateOrderResult {
  orderId: string;
  totalAmount: number;
  cardIds: string[];
  status: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  popular: boolean;
  imageUrl?: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("not authenticated");
  return { authorization: `Bearer ${token}` };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(await authHeader()), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Local UI iteration without the API/CORS/tunnel: mirrors the four brands the
 * backend stub pins (ids match services/src/giftcards/stub.ts). DEV-only.
 */
const DEV_FALLBACK_CATALOG: CatalogProduct[] = [
  { id: "TREM_VIRTUAL_VISA", name: "Visa Gift Card", popular: true },
  { id: "TREM_AMAZON", name: "Amazon", popular: true },
  { id: "TREM_STARBUCKS", name: "Starbucks", popular: true },
  { id: "TREM_WALMART", name: "Walmart", popular: true },
];

/** Public storefront catalog (no auth) — popular pinned products by default. */
export async function getCatalog(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(`${config.apiUrl}/catalog`);
    if (!res.ok) throw new Error(`Catalog unavailable (HTTP ${res.status})`);
    const body = (await res.json()) as { products: CatalogProduct[] };
    return body.products;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[catalog] API unreachable — using DEV fallback brands:", e);
      return DEV_FALLBACK_CATALOG;
    }
    throw e;
  }
}

export const api = {
  createOrder: (items: CartItemInput[], acknowledged: boolean, fromName?: string) =>
    req<CreateOrderResult>("/orders", {
      method: "POST",
      body: JSON.stringify({ items, acknowledged, ackVersion: "v1", fromName }),
    }),
  checkout: (orderId: string) =>
    req<{ url: string; sessionId: string }>("/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),
};
