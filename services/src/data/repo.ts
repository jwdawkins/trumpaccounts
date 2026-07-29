import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  BatchGetCommand,
  TransactWriteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Order, Card, CardEvent } from "../domain/types";
import { CardState, assertTransition } from "../domain/states";
import { KEY, GSI, EVENT_SK_PREFIX, EntityType } from "./keys";

/**
 * DynamoDB single-table repository (handoff §5).
 *
 * Canonical records:
 *   Order  -> PK=ORDER#<id>  SK=META    (carries cardIds[])
 *   Card   -> PK=CARD#<id>   SK=META    (carries buyerId/createdAt/state/tokenHash for GSIs)
 *   Event  -> PK=CARD#<id>   SK=EVT#<ts>#<eventId>
 *
 * GSI1 byBuyer (buyerId/createdAt): buyer history (orders + cards).
 * GSI2 byState (state/createdAt):   admin dashboards/filters.
 * GSI3 byToken (claimTokenHash):    claim resolution.
 */
export class Repo {
  private readonly doc: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(tableName: string, client?: DynamoDBClient) {
    this.table = tableName;
    this.doc = DynamoDBDocumentClient.from(client ?? new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  // ---- writes ----

  /** Create an order and its cards atomically (order + N card items). */
  async putOrderWithCards(order: Order, cards: Card[]): Promise<void> {
    const items = [
      {
        Put: {
          TableName: this.table,
          Item: this.orderItem(order),
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      ...cards.map((card) => ({
        Put: {
          TableName: this.table,
          Item: this.cardItem(card),
          ConditionExpression: "attribute_not_exists(PK)",
        },
      })),
    ];
    await this.doc.send(new TransactWriteCommand({ TransactItems: items }));
  }

  /** Overwrite an order item (e.g. status/stripe ids after payment). */
  async saveOrder(order: Order): Promise<void> {
    await this.doc.send(
      new PutCommand({ TableName: this.table, Item: this.orderItem(order) }),
    );
  }

  /** Overwrite a card item (leg/attribute changes with no state transition). */
  async saveCard(card: Card): Promise<void> {
    await this.doc.send(
      new PutCommand({ TableName: this.table, Item: this.cardItem(card) }),
    );
  }

  /**
   * Idempotency guard for webhook processing. Returns true if this eventId was
   * newly marked (safe to process), false if already seen (skip — §8/§6.2).
   */
  async markEventProcessed(eventId: string, ttlDays = 30): Promise<boolean> {
    const ttl = Math.floor(Date.now() / 1000) + ttlDays * 86400;
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            PK: `STRIPE_EVT#${eventId}`,
            SK: "META",
            entityType: "EVENT" as EntityType,
            processedAt: new Date().toISOString(),
            ttl,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }

  async appendEvent(event: CardEvent): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          ...KEY.event(event.cardId, event.timestamp, event.eventId),
          entityType: "EVENT" as EntityType,
          ...event,
        },
      }),
    );
  }

  /**
   * Transition a card's state with an optimistic guard + audit event, atomically.
   * Throws InvalidTransitionError (client-side) or ConditionalCheckFailed (if the
   * card is not in `from` when the write lands — concurrent change).
   */
  async transitionCard(params: {
    card: Card;
    to: CardState;
    actor: string;
    reason?: string;
    requestId?: string;
    patch?: Partial<Card>;
    event: CardEvent;
  }): Promise<void> {
    const { card, to, patch = {}, event } = params;
    assertTransition(card.state, to);

    const now = new Date(event.timestamp);
    const merged: Card = { ...card, ...patch, state: to, updatedAt: now.toISOString() };

    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.table,
              Item: this.cardItem(merged),
              ConditionExpression: "#s = :from",
              ExpressionAttributeNames: { "#s": "state" },
              ExpressionAttributeValues: { ":from": card.state },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: {
                ...KEY.event(event.cardId, event.timestamp, event.eventId),
                entityType: "EVENT" as EntityType,
                ...event,
              },
            },
          },
        ],
      }),
    );
  }

  // ---- reads ----

  async getOrder(orderId: string): Promise<Order | undefined> {
    const r = await this.doc.send(
      new GetCommand({ TableName: this.table, Key: KEY.order(orderId) }),
    );
    return r.Item ? this.toOrder(r.Item) : undefined;
  }

  async getCard(cardId: string): Promise<Card | undefined> {
    const r = await this.doc.send(
      new GetCommand({ TableName: this.table, Key: KEY.card(cardId) }),
    );
    return r.Item ? this.toCard(r.Item) : undefined;
  }

  async getOrderWithCards(
    orderId: string,
  ): Promise<{ order: Order; cards: Card[] } | undefined> {
    const order = await this.getOrder(orderId);
    if (!order) return undefined;
    const cards = await this.getCards(order.cardIds);
    return { order, cards };
  }

  async getCards(cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return [];
    const r = await this.doc.send(
      new BatchGetCommand({
        RequestItems: {
          [this.table]: { Keys: cardIds.map((id) => KEY.card(id)) },
        },
      }),
    );
    return (r.Responses?.[this.table] ?? []).map((i) => this.toCard(i));
  }

  /** Buyer history via GSI1 (orders + cards for the buyer, newest first). */
  async listBuyerHistory(buyerId: string): Promise<{ orders: Order[]; cards: Card[] }> {
    const r = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: GSI.byBuyer,
        KeyConditionExpression: "buyerId = :b",
        ExpressionAttributeValues: { ":b": buyerId },
        ScanIndexForward: false, // newest first
      }),
    );
    const orders: Order[] = [];
    const cards: Card[] = [];
    for (const item of r.Items ?? []) {
      if (item.entityType === "ORDER") orders.push(this.toOrder(item));
      else if (item.entityType === "CARD") cards.push(this.toCard(item));
    }
    return { orders, cards };
  }

  /** Resolve a card from a claim-token hash via GSI3 (M3 claim flow). */
  async findCardByTokenHash(claimTokenHash: string): Promise<Card | undefined> {
    const r = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        IndexName: GSI.byToken,
        KeyConditionExpression: "claimTokenHash = :h",
        ExpressionAttributeValues: { ":h": claimTokenHash },
        Limit: 1,
      }),
    );
    const item = r.Items?.[0];
    return item ? this.toCard(item) : undefined;
  }

  /** Full audit timeline for a card (admin drill-in). */
  async listCardEvents(cardId: string): Promise<CardEvent[]> {
    const r = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :evt)",
        ExpressionAttributeValues: {
          ":pk": `CARD#${cardId}`,
          ":evt": EVENT_SK_PREFIX,
        },
      }),
    );
    return (r.Items ?? []).map((i) => this.toEvent(i));
  }

  // ---- marshalling ----

  private orderItem(order: Order): Record<string, unknown> {
    return {
      ...KEY.order(order.orderId),
      entityType: "ORDER" as EntityType,
      ...order,
    };
  }

  private cardItem(card: Card): Record<string, unknown> {
    // buyerId + createdAt drive GSI1; state -> GSI2; claimTokenHash -> GSI3.
    return {
      ...KEY.card(card.cardId),
      entityType: "CARD" as EntityType,
      ...card,
    };
  }

  private toOrder(item: Record<string, unknown>): Order {
    const { PK, SK, entityType, ...rest } = item;
    void PK; void SK; void entityType;
    return rest as unknown as Order;
  }

  private toCard(item: Record<string, unknown>): Card {
    const { PK, SK, entityType, ...rest } = item;
    void PK; void SK; void entityType;
    return rest as unknown as Card;
  }

  private toEvent(item: Record<string, unknown>): CardEvent {
    const { PK, SK, entityType, ...rest } = item;
    void PK; void SK; void entityType;
    return rest as unknown as CardEvent;
  }
}
