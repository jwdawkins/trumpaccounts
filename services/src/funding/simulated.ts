import {
  TrumpAccountFundingProvider,
  ContributeInput,
  ContributeResult,
  TrumpFundingError,
} from "./provider";

/**
 * Best-effort account-holder name from a Trump contribution URL. The slug is the
 * first path segment with a trailing `-<id>` stripped; hyphens become spaces and
 * it is title-cased. e.g. "ryleed-83c28dd6" -> "Ryleed", "rylee-dawkins-ab12" ->
 * "Rylee Dawkins". Returns undefined if nothing usable is found.
 */
export function nameFromContributionUrl(linkedRef: string): string | undefined {
  let seg = "";
  try {
    seg = new URL(linkedRef).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    seg = linkedRef.split("?")[0].split("/").filter(Boolean).pop() ?? "";
  }
  const parts = seg.split("-");
  if (parts.length > 1) parts.pop(); // drop the trailing opaque id
  const name = parts.join(" ").replace(/[^a-zA-Z ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return undefined;
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Stand-in Trump-Account funding provider used until a real debit card is wired
 * (see [[trump-funding-flow]]). Assumes the contribution succeeds. For exercising
 * the retry path, set TRUMP_FUNDING_SIM_FAIL=true to make contribute() throw a
 * retryable error.
 */
export class SimulatedTrumpFundingProvider implements TrumpAccountFundingProvider {
  async getAccountHolderName(input: { linkedRef: string; recipientName?: string }): Promise<string | undefined> {
    // Derive the account-holder name from the linked contribution URL slug so the
    // D3 name-match reflects the ACTUAL account the recipient linked — NOT the
    // expected name. e.g. ".../ryleed-83c28dd6/?..." -> "Ryleed". The real provider
    // scrapes the full rendered name; slugs may be compressed (first name + last
    // initial), so a legitimate match needs a link whose slug matches the name.
    return nameFromContributionUrl(input.linkedRef);
  }

  async contribute(input: ContributeInput): Promise<ContributeResult> {
    if (process.env.TRUMP_FUNDING_SIM_FAIL === "true") {
      throw new TrumpFundingError("simulated Robinhood outage", true);
    }
    return { confirmationRef: `SIM-FUND-${input.cardId.slice(0, 12)}` };
  }
}
