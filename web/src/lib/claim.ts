import { config } from "../config";

export type StepStatus = "done" | "active" | "pending" | "attention";
export interface ChecklistStep {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
  rewardLink?: string;
}
export interface ClaimDetails {
  cardId: string;
  amount: number;
  trumpAmount: number;
  giftCardAmount: number;
  trumpPercent: number;
  fromName?: string;
  recipientName?: string;
  message?: string;
  needsGiftCardSelection: boolean;
  allowedGiftCardProducts: string[];
  selectedGiftCardProduct?: string;
  state: string;
  complete: boolean;
  inProgress: boolean;
  headline: string;
  checklist: ChecklistStep[];
}
export type GiftCardType = "gift_card" | "prepaid_visa" | "cash_out" | "donation";
export interface CatalogProduct {
  id: string;
  name: string;
  popular: boolean;
  type: GiftCardType;
  groupLabel: string;
  deliveryNote: string;
  physical: boolean;
  feeBearing: boolean;
  imageUrl?: string;
  /** What the recipient receives (reduced by fee for cash-out). */
  netCents: number;
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
  catalog: (token: string) =>
    req<{ products: CatalogProduct[]; senderPinned: boolean; budgetCents: number }>("/claim/catalog", token),
  select: (token: string, productId: string) =>
    req<{ ok: boolean }>("/claim/select", token, { method: "POST", body: JSON.stringify({ productId }) }),
  link: (token: string, payload: string) =>
    req<{ ok: boolean; state: string }>("/claim/link", token, { method: "POST", body: JSON.stringify({ payload }) }),
  noAccount: (token: string) =>
    req<{ ok: boolean; state: string }>("/claim/no-account", token, { method: "POST" }),
};
