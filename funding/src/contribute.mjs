import { chromium } from "playwright";

/**
 * Drives a recipient's Trump Account contribution link (Robinhood, on behalf of
 * the U.S. Treasury) like a human, funding it on behalf of the gifter.
 *
 * Verified flow (2026-07-30):
 *   1. Landing            -> "Get started"
 *   2. Enter amount       -> Continue
 *   3. Add a message      -> "Your name" (gifter) + optional message -> Continue
 *   4. Review             -> tick "irrevocable contribution" acknowledgment
 *                         -> "Continue to payment"
 *   5. Payment            -> DEBIT CARD ONLY (Stripe): email + card + billing
 *                         -> "Pay now"
 *
 * Without `card`, it stops at step 5 (the debit-card page) and returns — this is
 * the current mode until a real debit card is supplied. With `card`, it fills +
 * submits (UNTESTED — see fillDebitCard).
 *
 * @param {object} opts
 * @param {string} opts.url            contribution link (linkedTrumpAccountRef)
 * @param {number} opts.amountCents    Trump contribution portion, integer cents
 * @param {string} opts.fromName       gifter display name
 * @param {string} [opts.message]      optional gift message
 * @param {object} [opts.card]         debit card + billing (runtime only, never stored in code)
 * @param {boolean}[opts.headless=true]
 * @param {string} [opts.screenshotPath]
 * @returns {Promise<{reachedPayment:boolean, submitted:boolean, accountHolderName?:string, amount:string}>}
 */
export async function contribute(opts) {
  const { url, amountCents, fromName, message = "", card, headless = true, screenshotPath } = opts;
  const amount = (amountCents / 100).toFixed(2);

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    // 1. Get started
    await page.getByRole("button", { name: /get started/i }).first().click();

    // 2. Amount
    const amt = page.getByLabel(/contribution amount/i);
    await amt.waitFor({ state: "visible", timeout: 20000 });
    await amt.fill(amount);
    await page.getByRole("button", { name: /^continue$/i }).click();

    // 3. Name + message (the account holder's name is the "To" — read it at review)
    const nameField = page.getByPlaceholder(/your name/i);
    await nameField.waitFor({ state: "visible", timeout: 20000 });
    await nameField.fill(fromName);
    if (message) await page.getByPlaceholder(/optional message/i).fill(message.slice(0, 100));
    await page.getByRole("button", { name: /^continue$/i }).click();

    // 4. Review -> read account-holder name, tick acknowledgment, continue to payment
    await page.getByText(/review your contribution/i).waitFor({ state: "visible", timeout: 20000 });
    const accountHolderName = await page
      .evaluate(() => {
        const t = document.body.innerText;
        const m = t.match(/To\s*\n+\s*([^\n|]+)/i) || t.match(/To\s*\|\s*([^|]+)/i);
        return m ? m[1].trim() : undefined;
      })
      .catch(() => undefined);

    const payBtn = page.getByRole("button", { name: /continue to payment/i });
    // Tick the custom acknowledgment checkbox (several strategies), then wait
    // for the pay button to enable before proceeding.
    for (let i = 0; i < 5 && (await payBtn.isDisabled().catch(() => true)); i++) {
      await page.locator('input[type="checkbox"]').first().click({ force: true }).catch(() => {});
      await page.locator('input[type="checkbox"]').first().evaluate((el) => el.click()).catch(() => {});
      await page.getByText(/i acknowledge/i).click().catch(() => {});
      await page.waitForTimeout(600);
    }
    await payBtn.click();
    await page.getByText(/debit card/i).first().waitFor({ state: "visible", timeout: 20000 });
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

    if (!card) {
      return { reachedPayment: true, submitted: false, accountHolderName, amount };
    }

    await fillDebitCard(page, card);
    // NOTE: submission intentionally left to a human-reviewed step for now.
    return { reachedPayment: true, submitted: false, accountHolderName, amount };
  } finally {
    await browser.close();
  }
}

/**
 * Fill the Stripe debit-card + billing form. UNTESTED — pending a real debit
 * card and a decision on the hCaptcha / human-security challenge present on the
 * payment step. Card details are RUNTIME-ONLY and must never be committed/logged.
 */
async function fillDebitCard(page, card) {
  await page.getByLabel(/email/i).fill(card.email);
  // Stripe hosts card fields in iframes titled "Secure payment input frame".
  const cardFrame = page.frameLocator('iframe[title*="payment input" i]').first();
  await cardFrame.getByPlaceholder(/1234 1234/).fill(card.number);
  await cardFrame.getByPlaceholder(/MM ?\/ ?YY/i).fill(card.exp);
  await cardFrame.getByPlaceholder(/CVC/i).fill(card.cvc);
  await page.getByLabel(/first name/i).fill(card.firstName);
  await page.getByLabel(/last name/i).fill(card.lastName);
  await page.getByLabel(/address/i).first().fill(card.address);
  // TODO(when real card provided): handle hCaptcha / human-security, then:
  //   await page.getByRole("button", { name: /pay now/i }).click();
  //   capture the receipt/confirmation number, return { submitted: true, reference }.
}
