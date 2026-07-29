/** Single-table key construction (handoff §5). */

export const KEY = {
  order: (orderId: string) => ({ PK: `ORDER#${orderId}`, SK: "META" }),
  card: (cardId: string) => ({ PK: `CARD#${cardId}`, SK: "META" }),
  event: (cardId: string, ts: string, eventId: string) => ({
    PK: `CARD#${cardId}`,
    SK: `EVT#${ts}#${eventId}`,
  }),
  user: (userId: string) => ({ PK: `USER#${userId}`, SK: "PROFILE" }),
  verifiedRecipient: (buyerId: string, recipientId: string) => ({
    PK: `USER#${buyerId}`,
    SK: `RECIP#${recipientId}`,
  }),
} as const;

export const EVENT_SK_PREFIX = "EVT#";

export type EntityType = "ORDER" | "CARD" | "EVENT" | "USER" | "RECIPIENT";

export const GSI = {
  byBuyer: "GSI1", // buyerId / createdAt
  byState: "GSI2", // state / createdAt
  byToken: "GSI3", // claimTokenHash
} as const;
