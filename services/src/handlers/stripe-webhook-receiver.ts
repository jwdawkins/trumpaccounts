import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { StripeProvider } from "../payments/stripe";
import { WebhookSignatureError } from "../payments/provider";
import { getStripeSecret } from "../config/secrets";

const sqs = new SQSClient({});
const SECRET_ARN = requireEnv("STRIPE_SECRET_ARN");
const QUEUE_URL = requireEnv("WEBHOOK_QUEUE_URL");

/**
 * POST /webhooks/stripe — inbound Stripe webhook (handoff §6.2, §3).
 * NOT behind the Cognito authorizer; auth IS the Stripe signature check.
 * Verifies the signature, then buffers the normalized event to SQS so the
 * processor can retry independently. Returns 2xx fast so Stripe won't retry.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const signature = event.headers?.["stripe-signature"];
  if (!signature) return { statusCode: 400, body: "missing signature" };

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : event.body ?? "";

  const secret = await getStripeSecret(SECRET_ARN);
  const provider = new StripeProvider(secret.secretKey, secret.webhookSigningSecret);

  let normalized;
  try {
    normalized = provider.parseWebhook(rawBody, signature);
  } catch (e) {
    if (e instanceof WebhookSignatureError) {
      console.warn("rejected webhook: bad signature");
      return { statusCode: 400, body: "invalid signature" };
    }
    throw e;
  }

  if (normalized.kind === "IGNORED") {
    return { statusCode: 200, body: "ignored" };
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(normalized),
      MessageGroupId: "stripe",
      MessageDeduplicationId: normalized.eventId,
    }),
  );
  return { statusCode: 200, body: "queued" };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
