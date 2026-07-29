import { useState } from "react";
import { CartItemInput, TrumpPercent, DeliveryMethod } from "../lib/api";
import { dollarsToCents } from "../lib/format";

// Popular gift-card options pinned first (§7.1). Real Tremendous product IDs
// arrive with the catalog integration in M3; these are placeholders.
const POPULAR = [
  { id: "TREM_STARBUCKS", label: "Starbucks" },
  { id: "TREM_AMAZON", label: "Amazon" },
  { id: "TREM_PREPAID_VISA", label: "Prepaid Visa" },
];
const PERCENTS: TrumpPercent[] = [10, 25, 50, 100];

export function GiftForm({ onAdd }: { onAdd: (item: CartItemInput) => void }) {
  const [amount, setAmount] = useState("50");
  const [trumpPercent, setTrumpPercent] = useState<TrumpPercent>(50);
  const [products, setProducts] = useState<string[]>([]);
  const [recipientChoice, setRecipientChoice] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod>("EMAIL");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const is100 = trumpPercent === 100;

  const toggleProduct = (id: string) =>
    setProducts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = dollarsToCents(Number(amount));
    if (!Number.isFinite(cents) || cents < 100) return setError("Enter an amount of at least $1.00");
    if (delivery === "EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("A valid recipient email is required for email delivery");
    if (delivery === "SMS" && !phone.trim())
      return setError("A mobile number is required for SMS delivery");

    onAdd({
      totalAmount: cents,
      trumpPercent,
      allowedGiftCardProducts: is100 || recipientChoice ? [] : products,
      recipientName: recipientName.trim() || undefined,
      message: message.trim() || undefined,
      deliveryMethod: delivery,
      recipientEmail: delivery === "EMAIL" ? email.trim() : undefined,
      recipientPhone: delivery === "SMS" ? phone.trim() : undefined,
    });
    // reset the transient fields, keep amount/percent defaults
    setRecipientName("");
    setMessage("");
    setEmail("");
    setPhone("");
    setProducts([]);
  }

  const label = "block text-sm font-medium text-slate-700";
  const input =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Add a gift</h2>

      <div>
        <label className={label}>Gift amount (USD)</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-slate-400">$</span>
          <input
            className={input}
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={label}>Contribution to Trump Account</label>
        <div className="mt-2 flex gap-2">
          {PERCENTS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setTrumpPercent(p)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                trumpPercent === p
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {!is100 && (
        <div>
          <label className={label}>Gift card</label>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={recipientChoice}
              onChange={(e) => setRecipientChoice(e.target.checked)}
            />
            Let the recipient choose
          </label>
          {!recipientChoice && (
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR.map((prod) => (
                <button
                  type="button"
                  key={prod.id}
                  onClick={() => toggleProduct(prod.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    products.includes(prod.id)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {prod.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Recipient name (optional)</label>
          <input className={input} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Delivery</label>
          <select className={input} value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryMethod)}>
            <option value="EMAIL">Email the recipient</option>
            <option value="SMS">Text the recipient</option>
            <option value="SELF">I'll share it myself</option>
          </select>
        </div>
      </div>

      {delivery === "EMAIL" && (
        <div>
          <label className={label}>Recipient email</label>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      )}
      {delivery === "SMS" && (
        <div>
          <label className={label}>Recipient mobile</label>
          <input className={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}

      <div>
        <label className={label}>Message (optional)</label>
        <textarea className={input} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add to cart
      </button>
    </form>
  );
}
