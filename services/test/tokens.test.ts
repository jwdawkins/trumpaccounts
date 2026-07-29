import { describe, it, expect } from "vitest";
import { generateClaimToken, hashClaimToken, issueClaimToken } from "../src/domain/tokens";

describe("claim tokens (§8)", () => {
  it("generates >=26 char base32 tokens with adequate entropy", () => {
    const t = generateClaimToken();
    expect(t.length).toBeGreaterThanOrEqual(26);
    expect(t).toMatch(/^[A-Z2-7]+$/); // RFC4648 base32 alphabet, no padding
  });

  it("produces unique tokens", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateClaimToken()));
    expect(set.size).toBe(1000);
  });

  it("hashes deterministically to 64 hex chars and never equals the raw token", () => {
    const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const h = hashClaimToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashClaimToken(t));
    expect(h).not.toBe(t);
  });

  it("issueClaimToken returns a matching token/hash pair", () => {
    const { token, hash } = issueClaimToken();
    expect(hashClaimToken(token)).toBe(hash);
  });
});
