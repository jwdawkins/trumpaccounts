/**
 * Trump-Account funding abstraction (see [[trump-funding-flow]]). The real
 * implementation drives the Robinhood contribution page with Playwright to the
 * debit-card step; that runs in a browser-capable runtime (Fargate/container),
 * NOT the API Lambda. Until a real debit card is supplied, the simulated
 * provider stands in and assumes the contribution succeeds.
 */
export interface ContributeInput {
  /** Opaque payload captured from the recipient's Trump Account QR/link. */
  linkedRef: string;
  amountCents: number;
  /** Card id, used as an idempotency key on the contribution. */
  cardId: string;
  /** Gifter display name entered on the contribution page. */
  fromName?: string;
  /** Optional gift message. */
  message?: string;
}

export interface ContributeResult {
  /** Confirmation number recorded as the transfer reference. */
  confirmationRef: string;
}

export interface TrumpAccountFundingProvider {
  /**
   * Name shown on the contribution page ("Contribute to <name>'s future"),
   * used for the D3 name-match auto-verification. `recipientName` is a hint the
   * simulated provider echoes; the real provider ignores it and scrapes the page.
   */
  getAccountHolderName(input: {
    linkedRef: string;
    recipientName?: string;
    /** The real (Playwright) provider must drive the flow to the Review step to
     *  read the account name, which needs the amount + gifter name. */
    amountCents?: number;
    fromName?: string;
  }): Promise<string | undefined>;
  /** Drive the contribution to the debit-card step and complete it. */
  contribute(input: ContributeInput): Promise<ContributeResult>;
}

/** Funding failure. `retryable` = a transient/outage error worth resubmitting. */
export class TrumpFundingError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "TrumpFundingError";
  }
}
