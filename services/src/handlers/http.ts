import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function json(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** Extract the authenticated Cognito subject from a JWT-authorized event. */
export function buyerIdFromEvent(claims: Record<string, unknown> | undefined): string | undefined {
  const sub = claims?.sub;
  return typeof sub === "string" ? sub : undefined;
}
