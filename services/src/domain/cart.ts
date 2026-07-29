import { Order, Card, DeliveryMethod } from "./types";
import { CardState, GiftCardLeg, TrumpLeg } from "./states";
import { TrumpPercent, isTrumpPercent, assertCents, splitCents } from "./money";
import { newOrderId, newCardId } from "./tokens";

/** One line item from the storefront cart (§7.1). Amounts are integer cents. */
export interface CartItemInput {
  totalAmount: number;
  trumpPercent: number;
  allowedGiftCardProducts?: string[];
  selectedGiftCardProduct?: string;
  recipientName?: string;
  message?: string;
  deliveryMethod: DeliveryMethod;
  recipientEmail?: string;
  recipientPhone?: string;
}

export class CartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartValidationError";
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_MESSAGE = 500;
const MAX_ITEMS = 50;

export function validateCartItem(item: CartItemInput): void {
  assertCents(item.totalAmount, "totalAmount");
  if (item.totalAmount < 100) {
    throw new CartValidationError("Each gift must be at least $1.00");
  }
  if (!isTrumpPercent(item.trumpPercent)) {
    throw new CartValidationError(
      `trumpPercent must be one of 10, 25, 50, 100 (got ${item.trumpPercent})`,
    );
  }
  if (item.message && item.message.length > MAX_MESSAGE) {
    throw new CartValidationError(`message exceeds ${MAX_MESSAGE} chars`);
  }
  // Delivery method requirements (D2).
  switch (item.deliveryMethod) {
    case "EMAIL":
      if (!item.recipientEmail || !EMAIL_RE.test(item.recipientEmail)) {
        throw new CartValidationError("EMAIL delivery requires a valid recipientEmail");
      }
      break;
    case "SMS":
      if (!item.recipientPhone) {
        throw new CartValidationError("SMS delivery requires a recipientPhone");
      }
      break;
    case "SELF":
      break;
    default:
      throw new CartValidationError(`unknown deliveryMethod ${item.deliveryMethod}`);
  }
}

/**
 * Build an Order plus its Cards from a validated cart. Cards start in
 * PENDING_PAYMENT; gift-card leg is NONE at 100% Trump (D5), else awaiting
 * selection; Trump leg is unlinked until the recipient claims.
 */
export function buildOrderFromCart(
  buyerId: string,
  items: CartItemInput[],
  now: Date = new Date(),
): { order: Order; cards: Card[] } {
  if (items.length === 0) {
    throw new CartValidationError("cart is empty");
  }
  if (items.length > MAX_ITEMS) {
    throw new CartValidationError(`cart exceeds ${MAX_ITEMS} items`);
  }
  items.forEach(validateCartItem);

  const iso = now.toISOString();
  const orderId = newOrderId();

  const cards: Card[] = items.map((item) => {
    const pct = item.trumpPercent as TrumpPercent;
    const { trumpCents, giftCardCents } = splitCents(item.totalAmount, pct);
    const is100 = pct === 100;
    return {
      cardId: newCardId(),
      orderId,
      buyerId,
      totalAmount: item.totalAmount,
      trumpPercent: pct,
      trumpAmount: trumpCents,
      giftCardAmount: giftCardCents,
      allowedGiftCardProducts: is100 ? [] : item.allowedGiftCardProducts ?? [],
      selectedGiftCardProduct: undefined,
      recipientName: item.recipientName,
      message: item.message,
      deliveryMethod: item.deliveryMethod,
      recipientEmail: item.recipientEmail,
      recipientPhone: item.recipientPhone,
      state: CardState.PENDING_PAYMENT,
      giftCardLeg: is100 ? GiftCardLeg.NONE : GiftCardLeg.AWAITING_SELECTION,
      trumpLeg: TrumpLeg.UNLINKED,
      createdAt: iso,
      updatedAt: iso,
    };
  });

  const totalAmount = cards.reduce((sum, c) => sum + c.totalAmount, 0);

  const order: Order = {
    orderId,
    buyerId,
    totalAmount,
    status: "PENDING_PAYMENT",
    cardIds: cards.map((c) => c.cardId),
    createdAt: iso,
    updatedAt: iso,
  };

  return { order, cards };
}
