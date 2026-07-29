import { config } from "../config";

export interface ChecklistStep {
  key: string;
  label: string;
  done: boolean;
}
export interface ClaimDetails {
  cardId: string;
  amount: number;
  trumpAmount: number;
  giftCardAmount: number;
  trumpPercent: number;
  recipientName?: string;
  message?: string;
  needsGiftCardSelection: boolean;
  allowedGiftCardProducts: string[];
  selectedGiftCardProduct?: string;
  state: string;
  checklist: ChecklistStep[];
}
export interface CatalogProduct {
  id: string;
  name: string;
  popular: boolean;
}

async function req<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-claim-token": token, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const claimApi = {
  details: (token: string) => req<ClaimDetails>("/claim/details", token),
  catalog: (token: string) => req<{ products: CatalogProduct[]; senderPinned: boolean }>("/claim/catalog", token),
  select: (token: string, productId: string) =>
    req<{ ok: boolean }>("/claim/select", token, { method: "POST", body: JSON.stringify({ productId }) }),
  link: (token: string, payload: string) =>
    req<{ ok: boolean; state: string }>("/claim/link", token, { method: "POST", body: JSON.stringify({ payload }) }),
  noAccount: (token: string) =>
    req<{ ok: boolean; state: string }>("/claim/no-account", token, { method: "POST" }),
};
