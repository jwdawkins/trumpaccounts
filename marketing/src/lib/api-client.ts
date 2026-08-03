import { useMutation, type UseMutationResult } from "@tanstack/react-query";

/**
 * Local stand-in for the Replit `@workspace/api-client-react` package.
 *
 * The marketing site is hosted as a static bundle on S3 + CloudFront, so there
 * is no backend yet. These hooks preserve the exact interface the forms expect
 * (`.mutate({ data }, { onSuccess, onError })`, `.isPending`) but simply
 * simulate a successful submission.
 *
 * When a real backend (e.g. an API Gateway + Lambda) is ready, replace the body
 * of `submit` with a `fetch(ENDPOINT, ...)` call — nothing in the form
 * components needs to change.
 */

export interface WaitlistData {
  firstName: string;
  lastName: string;
  email: string;
  childrenCount?: number | null;
}

export interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ApiError {
  error?: string;
}

interface SubmitVars<T> {
  data: T;
}

// Simulate a network round-trip so the button's loading state is visible.
async function simulateSubmit<T>(kind: string, data: T): Promise<{ message: string }> {
  // eslint-disable-next-line no-console
  console.info(`[stub] ${kind} submission (no backend yet):`, data);
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { message: "ok" };
}

export function useJoinWaitlist(): UseMutationResult<
  { message: string },
  ApiError,
  SubmitVars<WaitlistData>
> {
  return useMutation({
    mutationFn: ({ data }: SubmitVars<WaitlistData>) => simulateSubmit("waitlist", data),
  });
}

export function useSubmitContact(): UseMutationResult<
  { message: string },
  ApiError,
  SubmitVars<ContactData>
> {
  return useMutation({
    mutationFn: ({ data }: SubmitVars<ContactData>) => simulateSubmit("contact", data),
  });
}
