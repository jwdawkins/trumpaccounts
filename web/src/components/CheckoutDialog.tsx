import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { api } from "../lib/api";
import { formatCents } from "../lib/format";

type Step = "email" | "code" | "acknowledge" | "paying" | "error";

export function CheckoutDialog({ onClose }: { onClose: () => void }) {
  const { email: signedInEmail, begin, confirm } = useAuth();
  const { lines } = useCart();
  const [step, setStep] = useState<Step>(signedInEmail ? "acknowledge" : "email");
  const [email, setEmail] = useState(signedInEmail ?? "");
  const [code, setCode] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Total Trump-contribution portion across the cart (integer cents).
  const trumpTotal = lines.reduce((sum, l) => sum + Math.round((l.totalAmount * l.trumpPercent) / 100), 0);

  // Once acknowledged, create the order and redirect to Stripe.
  useEffect(() => {
    if (step !== "paying") return;
    let cancelled = false;
    (async () => {
      try {
        const order = await api.createOrder(lines, true);
        const { url } = await api.checkout(order.orderId);
        if (!cancelled) window.location.href = url;
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStep("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, lines]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await begin(email.trim());
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirm(code.trim());
      setStep("acknowledge");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const primary =
    "w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checkout</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        {step === "email" && (
          <form onSubmit={submitEmail} className="space-y-3">
            <p className="text-sm text-slate-600">
              Enter your email — we&rsquo;ll send a one-time code to sign in or create your account.
            </p>
            <input
              className={input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button className={primary} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-slate-600">Enter the code we emailed to {email}.</p>
            <input
              className={input}
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
            <button className={primary} disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
          </form>
        )}

        {step === "acknowledge" && (
          <div className="space-y-4">
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              Trump Account contribution:{" "}
              <span className="font-semibold text-slate-900">{formatCents(trumpTotal)}</span>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>
                I acknowledge that I&rsquo;m sending {formatCents(trumpTotal)} as an{" "}
                <strong>irrevocable contribution</strong> to an established Trump Account.
              </span>
            </label>
            <button className={primary} disabled={!ack} onClick={() => setStep("paying")}>
              Continue to payment
            </button>
          </div>
        )}

        {step === "paying" && (
          <p className="py-6 text-center text-sm text-slate-600">Redirecting you to secure payment…</p>
        )}

        {step === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button className={primary} onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {error && step !== "error" && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
