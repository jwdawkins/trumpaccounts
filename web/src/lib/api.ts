import { config } from "../config";
import { fetchAuthSession } from "aws-amplify/auth";

export type TrumpPercent = 10 | 25 | 50 | 100;
export type DeliveryMethod = "EMAIL" | "SMS" | "SELF";

export interface CartItemInput {
  totalAmount: number; // cents
  trumpPercent: TrumpPercent;
  allowedGiftCardProducts?: string[];
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

export interface OrderCard {
  cardId: string;
  totalAmount: number;
  trumpPercent: number;
  trumpAmount: number;
  giftCardAmount: number;
  recipientName?: string;
  deliveryMethod: DeliveryMethod;
  status: string;
}
export interface OrderSummary {
  orderId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  cards: OrderCard[];
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

export const api = {
  createOrder: (items: CartItemInput[], acknowledged: boolean) =>
    req<CreateOrderResult>("/orders", {
      method: "POST",
      body: JSON.stringify({ items, acknowledged, ackVersion: "v1" }),
    }),
  checkout: (orderId: string) =>
    req<{ url: string; sessionId: string }>("/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),
  listOrders: () => req<{ orders: OrderSummary[] }>("/orders"),
  downloadCertificate: async (cardId: string): Promise<Blob> => {
    const res = await fetch(`${config.apiUrl}/cards/${cardId}/certificate`, {
      headers: await authHeader(),
    });
    if (!res.ok) throw new Error(`Certificate unavailable (HTTP ${res.status})`);
    return res.blob();
  },
};
