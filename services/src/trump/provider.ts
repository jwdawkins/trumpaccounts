/**
 * Trump Account provider abstraction (handoff §6.1) — the critical seam so the
 * transport can be swapped without touching business logic.
 *
 * MVP is ManualOps: there is no public Trump Account API, so verification and
 * transfers are performed out-of-band by an admin who records the outcome via
 * the admin ops endpoints (which advance the state machine). A future
 * PartnerApiProvider would implement this same interface to automate it.
 */

/** Opaque, provider-defined reference to a linked account (the decoded QR/link payload). */
export interface AccountRef {
  readonly raw: string;
}

export interface VerifyResult {
  readonly status: "VERIFIED" | "NOT_FOUND" | "INACTIVE";
  /** Name on the linked account, when the provider can surface it. */
  readonly accountHolderName?: string;
}

export type TransferStatus = "PENDING" | "SETTLED" | "FAILED";

export interface TrumpAccountProvider {
  verifyAccount(ref: AccountRef): Promise<VerifyResult>;
  initiateTransfer(
    ref: AccountRef,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<{ transferRef: string }>;
  getTransferStatus(transferRef: string): Promise<TransferStatus>;
}
