import { contribute } from "./contribute.mjs";

// CLI: node src/run.mjs --url <link> --amount <cents> --from "Name" [--message "..."] [--headed]
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const url = arg("url");
const amountCents = Number(arg("amount"));
const fromName = arg("from", "A friend");
const message = arg("message", "");
const headless = !process.argv.includes("--headed");

if (!url || !Number.isFinite(amountCents)) {
  console.error('Usage: node src/run.mjs --url <link> --amount <cents> --from "Name" [--message "..."] [--headed]');
  process.exit(1);
}

console.log(`Driving contribution: $${(amountCents / 100).toFixed(2)} from "${fromName}"…`);
const result = await contribute({
  url,
  amountCents,
  fromName,
  message,
  headless,
  screenshotPath: "payment-step.png",
});
console.log(JSON.stringify(result, null, 2));
console.log(
  result.reachedPayment
    ? `Reached the debit-card page (account holder: ${result.accountHolderName ?? "?"}). Screenshot: payment-step.png. No card entered.`
    : "Did not reach the payment step.",
);
