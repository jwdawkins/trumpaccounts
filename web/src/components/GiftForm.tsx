import { useEffect, useState } from "react";
import { CartItemInput, TrumpPercent, DeliveryMethod, VerificationMode, CatalogProduct, getCatalog } from "../lib/api";
import { dollarsToCents } from "../lib/format";

const PERCENTS: TrumpPercent[] = [10, 25, 50, 100];

export function GiftForm({ onAdd }: { onAdd: (item: CartItemInput) => void }) {
  const [amount, setAmount] = useState("50");
  const [trumpPercent, setTrumpPercent] = useState<TrumpPercent>(50);
  const [products, setProducts] = useState<string[]>([]);
  // Popular gift-card options (real Tremendous product ids) fetched from GET /catalog (§7.1).
  const [popular, setPopular] = useState<CatalogProduct[]>([]);
  const [recipientChoice, setRecipientChoice] = useState(true);
  const [verificationMode, setVerificationMode] = useState<VerificationMode>("VERIFIED");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod>("EMAIL");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isVerified = verificationMode === "VERIFIED";

  const is100 = trumpPercent === 100;

  useEffect(() => {
    getCatalog()
      .then(setPopular)
      .catch(() => setPopular([])); // storefront still works with recipient's-choice default
  }, []);

  const toggleProduct = (id: string) =>
    setProducts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = dollarsToCents(Number(amount));
    if (!Number.isFinite(cents) || cents < 100) return setError("Enter an amount of at least $1.00");
    if (isVerified && !recipientName.trim())
      return setError("A verified gift needs the recipient's name (it must match their Trump Account)");
    if (delivery === "EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("A valid recipient email is required for email delivery");
    if (delivery === "SMS" && !phone.trim())
      return setError("A mobile number is required for SMS delivery");

    onAdd({
      totalAmount: cents,
      trumpPercent,
      allowedGiftCardProducts: is100 || recipientChoice ? [] : products,
      verificationMode,
      // No recipient name on an open gift.
      recipientName: isVerified ? recipientName.trim() || undefined : undefined,
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
              {popular.length === 0 && (
                <p className="text-sm text-slate-500">Loading gift cards…</p>
              )}
              {popular.map((prod) => (
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
                  {prod.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className={label}>Gift type</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { mode: "VERIFIED", title: "Verified", desc: "Recipient name must match the Trump Account" },
            { mode: "OPEN", title: "Open", desc: "Post to anyone's Trump Account — no name check" },
          ] as const).map((opt) => (
            <button
              type="button"
              key={opt.mode}
              onClick={() => setVerificationMode(opt.mode)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                verificationMode === opt.mode
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <span className="block font-medium text-slate-800">{opt.title}</span>
              <span className="block text-xs text-slate-500">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${isVerified ? "grid-cols-2" : "grid-cols-1"}`}>
        {isVerified && (
          <div>
            <label className={label}>Recipient name</label>
            <input
              className={input}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Must match their Trump Account"
            />
          </div>
        )}
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
