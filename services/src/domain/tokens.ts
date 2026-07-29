import { randomBytes, createHash, randomUUID } from "node:crypto";

/**
 * Claim-token security (handoff §8):
 *   - >=128-bit random, Crockford-ish base32, 26+ chars, URL-safe.
 *   - Only the SHA-256 hash is ever persisted or indexed; the raw token lives
 *     only in the delivered link and is never logged.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648, no padding

function toBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Generate a fresh raw claim token. 20 bytes = 160 bits -> 32 base32 chars. */
export function generateClaimToken(): string {
  return toBase32(randomBytes(20));
}

/** One-way hash for storage/indexing. Never store the raw token. */
export function hashClaimToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Convenience: a raw token plus its storable hash. */
export function issueClaimToken(): { token: string; hash: string } {
  const token = generateClaimToken();
  return { token, hash: hashClaimToken(token) };
}

// Entity id helpers — prefixed UUIDs for readability in logs/console.
export const newOrderId = (): string => `ord_${randomUUID()}`;
export const newCardId = (): string => `crd_${randomUUID()}`;
export const newEventId = (): string => `evt_${randomUUID()}`;
