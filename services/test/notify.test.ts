import { describe, it, expect } from "vitest";
import { generateCertificatePdf } from "../src/notify/pdf";
import { claimUrl } from "../src/fulfillment/deliver";
import { certificateKey } from "../src/notify/store";

describe("claimUrl", () => {
  it("builds the claim URL and trims a trailing slash", () => {
    expect(claimUrl("http://x/", "TOK")).toBe("http://x/claim/TOK");
    expect(claimUrl("http://x", "TOK")).toBe("http://x/claim/TOK");
  });
});

describe("certificateKey", () => {
  it("is deterministic per card", () => {
    expect(certificateKey("crd_1")).toBe("certificates/crd_1.pdf");
  });
});

describe("generateCertificatePdf", () => {
  it("produces a valid, non-trivial PDF with a QR", async () => {
    const bytes = await generateCertificatePdf({
      amountCents: 5000,
      trumpPercent: 50,
      claimUrl: "http://localhost:5173/claim/ABC123",
      recipientName: "Sam",
      message: "Happy birthday!",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
