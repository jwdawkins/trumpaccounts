import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export interface StripeSecret {
  secretKey: string;
  webhookSigningSecret: string;
}

let cached: StripeSecret | undefined;
const client = new SecretsManagerClient({});

/**
 * Fetch + cache the Stripe secret (secret key + webhook signing secret) from
 * Secrets Manager (§8). Cached for the life of the warm Lambda container.
 * The secret VALUE is set by a human in the AWS console — never in code/chat.
 */
export async function getStripeSecret(secretArn: string): Promise<StripeSecret> {
  if (cached) return cached;
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!res.SecretString) throw new Error("Stripe secret has no value set yet");
  const parsed = JSON.parse(res.SecretString) as Partial<StripeSecret>;
  if (!parsed.secretKey || !parsed.webhookSigningSecret) {
    throw new Error("Stripe secret missing secretKey/webhookSigningSecret");
  }
  cached = { secretKey: parsed.secretKey, webhookSigningSecret: parsed.webhookSigningSecret };
  return cached;
}

export interface TremendousSecret {
  apiKey: string;
  environment: "sandbox" | "production";
  /** Funding source id, or a magic value (BALANCE | INVOICE | INVOICE_THEN_BALANCE). */
  fundingSourceId: string;
}

const cachedTremendous = new Map<string, TremendousSecret>();

/**
 * Fetch + cache a Tremendous secret by ARN (§6.3). There are two: a read-only
 * catalog key (web/claim paths) and an order key (async worker only) — cached
 * independently so a process reading both never crosses them. Returns `null`
 * when the API key is not configured yet (empty or the deploy-time placeholder)
 * so callers can fall back to the stub provider; throws only on genuinely
 * unreadable/malformed secrets. Environment defaults to sandbox, funding source
 * to BALANCE (the single $100k sandbox balance). The API key is pasted into the
 * secret in the AWS console — never in code/chat.
 */
export async function getTremendousSecret(secretArn: string): Promise<TremendousSecret | null> {
  const hit = cachedTremendous.get(secretArn);
  if (hit) return hit;
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!res.SecretString) return null;
  const parsed = JSON.parse(res.SecretString) as Partial<TremendousSecret>;
  if (!parsed.apiKey || parsed.apiKey.startsWith("REPLACE_ME")) return null; // not configured yet
  const secret: TremendousSecret = {
    apiKey: parsed.apiKey,
    environment: parsed.environment === "production" ? "production" : "sandbox",
    fundingSourceId: parsed.fundingSourceId || "BALANCE",
  };
  cachedTremendous.set(secretArn, secret);
  return secret;
}
