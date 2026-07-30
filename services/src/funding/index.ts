import { TrumpAccountFundingProvider } from "./provider";
import { SimulatedTrumpFundingProvider } from "./simulated";

export * from "./provider";

let cached: Promise<TrumpAccountFundingProvider> | undefined;

/**
 * Active Trump-funding provider. `TRUMP_FUNDING_PROVIDER=playwright` selects the
 * real browser-driven provider (only set on the container-image Lambda, which
 * ships Chromium); otherwise the simulated provider (assumes success). The real
 * provider is loaded via dynamic import so the zip API Lambdas never bundle
 * playwright-core/Chromium (see [[trump-funding-flow]]).
 */
export function getTrumpFundingProvider(): Promise<TrumpAccountFundingProvider> {
  if (!cached) cached = build();
  return cached;
}

async function build(): Promise<TrumpAccountFundingProvider> {
  if (process.env.TRUMP_FUNDING_PROVIDER === "playwright") {
    const { PlaywrightTrumpFundingProvider } = await import("./playwright-provider");
    return new PlaywrightTrumpFundingProvider();
  }
  return new SimulatedTrumpFundingProvider();
}
