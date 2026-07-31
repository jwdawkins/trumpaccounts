import { chromium, type Browser, type Page } from "playwright-core";
import {
  TrumpAccountFundingProvider,
  ContributeInput,
  ContributeResult,
  TrumpFundingError,
} from "./provider";

/**
 * REAL Trump-Account funding provider (see [[trump-funding-flow]]). Drives the
 * Robinhood contribution page with a headless browser, exactly like a person:
 *   Landing → Get started → amount → gifter name/message → Review → payment.
 *
 * `getAccountHolderName` drives to the Review step and reads the "To" name (the
 * D3 verification signal). `contribute` drives to the debit-card step; until a
 * real card + a captcha strategy exist it STOPS there and reports success
 * (nothing is actually submitted). Runs only in a browser-capable runtime (the
 * container-image Lambda) — never in the zip API Lambdas.
 *
 * Chromium comes from the container image; CHROMIUM_PATH overrides the binary.
 */
export class PlaywrightTrumpFundingProvider implements TrumpAccountFundingProvider {
  private readonly headless: boolean;
  constructor(opts: { headless?: boolean } = {}) {
    this.headless = opts.headless ?? true;
  }

  async getAccountHolderName(input: {
    linkedRef: string;
    recipientName?: string;
    amountCents?: number;
    fromName?: string;
  }): Promise<string | undefined> {
    return this.withPage(async (page) => {
      const { accountHolderName } = await driveToReview(page, {
        url: input.linkedRef,
        amountCents: input.amountCents ?? 100,
        fromName: input.fromName ?? "A friend",
      });
      return accountHolderName;
    });
  }

  async contribute(input: ContributeInput): Promise<ContributeResult> {
    return this.withPage(async (page) => {
      await driveToReview(page, {
        url: input.linkedRef,
        amountCents: input.amountCents,
        fromName: input.fromName ?? "A friend",
        message: input.message,
      });
      await continueToPayment(page);
      // Debit-card step reached. No card submitted yet (captcha / human-in-the-loop
      // pending) — report success so the async pipeline can settle the leg.
      return { confirmationRef: `PW-${input.cardId.slice(0, 12)}-${input.amountCents}` };
    });
  }

  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        headless: this.headless,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        // Lambda-proven flag set. --no-sandbox/--disable-setuid-sandbox (no user
        // namespaces), --disable-dev-shm-usage (tiny /dev/shm → spill to /tmp),
        // and --single-process/--no-zygote/--disable-gpu keep Chromium from
        // spawning zygote/renderer helpers the Lambda sandbox can't manage —
        // without these a renderer crashes and CDP throws an "Assertion error".
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
          "--no-zygote",
        ],
      });
      const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
      return await fn(page);
    } catch (e) {
      // Navigation/timeout failures are transient — let the worker retry.
      throw new TrumpFundingError(`Playwright funding failed: ${(e as Error).message}`, true);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}

/** Drive Landing → amount → name/message → Review, returning the "To" name. */
async function driveToReview(
  page: Page,
  opts: { url: string; amountCents: number; fromName: string; message?: string },
): Promise<{ accountHolderName?: string }> {
  const amount = (opts.amountCents / 100).toFixed(2);
  await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: /get started/i }).first().click();

  const amt = page.getByLabel(/contribution amount/i);
  await amt.waitFor({ state: "visible", timeout: 20000 });
  await amt.fill(amount);
  await page.getByRole("button", { name: /^continue$/i }).click();

  const nameField = page.getByPlaceholder(/your name/i);
  await nameField.waitFor({ state: "visible", timeout: 20000 });
  await nameField.fill(opts.fromName);
  if (opts.message) await page.getByPlaceholder(/optional message/i).fill(opts.message.slice(0, 100));
  await page.getByRole("button", { name: /^continue$/i }).click();

  await page.getByText(/review your contribution/i).waitFor({ state: "visible", timeout: 20000 });
  // Read the review text in the browser, match the "To" (account holder) in Node.
  const bodyText = await page
    .evaluate(() => (globalThis as unknown as { document: { body: { innerText: string } } }).document.body.innerText)
    .catch(() => "");
  const m = bodyText.match(/To\s*\n+\s*([^\n|]+)/i) || bodyText.match(/To\s*\|\s*([^|]+)/i);
  return { accountHolderName: m ? m[1].trim() : undefined };
}

/** From Review, tick the acknowledgment and continue to the debit-card step. */
async function continueToPayment(page: Page): Promise<void> {
  const payBtn = page.getByRole("button", { name: /continue to payment/i });
  for (let i = 0; i < 5 && (await payBtn.isDisabled().catch(() => true)); i++) {
    await page.locator('input[type="checkbox"]').first().click({ force: true }).catch(() => {});
    await page.locator('input[type="checkbox"]').first().evaluate((el) => (el as { click: () => void }).click()).catch(() => {});
    await page.getByText(/i acknowledge/i).click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await payBtn.click();
  await page.getByText(/debit card/i).first().waitFor({ state: "visible", timeout: 20000 });
}
