import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TremendousGiftCardProvider, TremendousError } from "../src/giftcards/tremendous";

const cfg = { apiKey: "test-key", environment: "sandbox" as const, fundingSourceId: "BALANCE" };

/** Build a fetch mock that returns queued responses in order. */
function mockFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("TremendousGiftCardProvider.listCatalog", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps products, flags popular brands, sorts popular-first, computes cents range", async () => {
    const calls = mockFetch([
      {
        body: {
          products: [
            { id: "P_ADIDAS", name: "adidas", category: "merchant_card", skus: [{ min: 5, max: 250 }] },
            { id: "P_AMZN", name: "Amazon.com", category: "merchant_card", skus: [{ min: 1, max: 2000 }], images: [{ src: "https://img/amzn.png" }] },
          ],
        },
      },
    ]);
    const provider = new TremendousGiftCardProvider(cfg);
    const catalog = await provider.listCatalog();

    // Amazon is popular so it sorts first.
    expect(catalog.map((p) => p.id)).toEqual(["P_AMZN", "P_ADIDAS"]);
    expect(catalog[0]).toMatchObject({ popular: true, minCents: 100, maxCents: 200000, imageUrl: "https://img/amzn.png" });
    expect(catalog[1]).toMatchObject({ popular: false, minCents: 500, maxCents: 25000 });
    // Sandbox base URL + US/USD filter + bearer auth.
    expect(calls[0].url).toBe("https://testflight.tremendous.com/api/v2/products?country=US&currency=USD");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
  });

  it("caches within TTL — a second call does not hit the API again", async () => {
    mockFetch([{ body: { products: [{ id: "P1", name: "Amazon", skus: [] }] } }]);
    const provider = new TremendousGiftCardProvider(cfg);
    await provider.listCatalog();
    await provider.listCatalog();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("TremendousGiftCardProvider.createOrder", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("EMAIL: sends denomination in dollars, funding source, recipient email; returns refs", async () => {
    const calls = mockFetch([
      {
        body: {
          order: {
            id: "ORD1", status: "EXECUTED",
            rewards: [{ id: "RWD1", delivery: { link: "https://reward/1" } }],
            payment: { subtotal: 25, fees: 0, total: 25 },
          },
        },
      },
    ]);
    const provider = new TremendousGiftCardProvider(cfg);
    const res = await provider.createOrder({
      externalId: "card-123",
      productId: "P_AMZN",
      amountCents: 2500,
      recipientName: "Jane Doe",
      recipientEmail: "jane@example.com",
      delivery: "EMAIL",
    });

    expect(res).toMatchObject({ orderId: "ORD1", rewardId: "RWD1", status: "EXECUTED", link: "https://reward/1", recipientCents: 2500, feeCents: 0, totalCents: 2500 });
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent).toMatchObject({
      external_id: "card-123",
      payment: { funding_source_id: "BALANCE" },
      reward: {
        value: { denomination: 25, currency_code: "USD" },
        products: ["P_AMZN"],
        delivery: { method: "EMAIL" },
        recipient: { name: "Jane Doe", email: "jane@example.com" },
      },
    });
  });

  it("LINK: omits email when absent and reads the redemption link from the reward", async () => {
    const calls = mockFetch([
      { body: { order: { id: "ORD2", status: "EXECUTED", rewards: [{ id: "RWD2" }] } } },
      { body: { reward: { id: "RWD2", delivery: { method: "LINK", link: "https://reward/abc" } } } },
    ]);
    const provider = new TremendousGiftCardProvider(cfg);
    const res = await provider.createOrder({
      externalId: "card-9",
      productId: "P_AMZN",
      amountCents: 5000,
      recipientName: "No Email",
      delivery: "LINK",
    });

    expect(res.link).toBe("https://reward/abc");
    expect(calls[1].url).toBe("https://testflight.tremendous.com/api/v2/rewards/RWD2");
    expect(JSON.parse(calls[0].init.body as string).reward.recipient).toEqual({ name: "No Email" });
  });

  it("throws TremendousError carrying the HTTP status on a 4xx", async () => {
    mockFetch([{ status: 422, body: { errors: { message: "insufficient funds" } } }]);
    const provider = new TremendousGiftCardProvider(cfg);
    await expect(
      provider.createOrder({
        externalId: "c",
        productId: "P",
        amountCents: 100,
        recipientName: "X",
        recipientEmail: "x@example.com",
        delivery: "EMAIL",
      }),
    ).rejects.toMatchObject({ name: "TremendousError", status: 422 });
  });

  it("uses the production base URL when configured", async () => {
    const calls = mockFetch([{ body: { order: { id: "O", status: "EXECUTED", rewards: [{ id: "R", delivery: { link: "https://reward/x" } }] } } }]);
    const provider = new TremendousGiftCardProvider({ ...cfg, environment: "production" });
    await provider.createOrder({
      externalId: "c", productId: "P", amountCents: 100, recipientName: "X",
      recipientEmail: "x@example.com", delivery: "EMAIL",
    });
    expect(calls[0].url).toBe("https://www.tremendous.com/api/v2/orders");
  });
});

// Sanity: TremendousError is an Error subclass.
it("TremendousError is an Error", () => {
  expect(new TremendousError(500, "x")).toBeInstanceOf(Error);
});
