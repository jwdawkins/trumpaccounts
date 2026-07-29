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
