import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { api, type CartItemInput } from "@/lib/api";
import { formatCents } from "@/lib/format";

type Step = "email" | "code" | "acknowledge" | "paying" | "error";

export function CheckoutDialog({ onClose }: { onClose: () => void }) {
  const { email: signedInEmail, begin, confirm } = useAuth();
  const { lines } = useCart();

  const [step, setStep] = useState<Step>(signedInEmail ? "acknowledge" : "email");
  const [email, setEmail] = useState(signedInEmail ?? "");
  const [code, setCode] = useState("");
  const [fromName, setFromName] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Total Trump-contribution portion across the cart (integer cents).
  const trumpTotal = lines.reduce((sum, l) => sum + Math.round((l.totalAmount * l.trumpPercent) / 100), 0);

  // Once acknowledged, create the order (from the cart lines, which already carry
  // recipient details from the builder) and redirect to Stripe.
  useEffect(() => {
    if (step !== "paying") return;
    let cancelled = false;
    (async () => {
      try {
        const items: CartItemInput[] = lines.map((l) => ({
          totalAmount: l.totalAmount,
          trumpPercent: l.trumpPercent,
          allowedGiftCardProducts: l.allowedGiftCardProducts,
          brandName: l.brandName,
          verificationMode: l.verificationMode ?? "OPEN",
          recipientName: l.recipientName,
          message: l.message,
          deliveryMethod: l.deliveryMethod ?? "SELF",
          recipientEmail: l.recipientEmail,
          recipientPhone: l.recipientPhone,
        }));
        const order = await api.createOrder(items, true, fromName.trim() || undefined);
        const { url } = await api.checkout(order.orderId);
        if (!cancelled) {
          // Keep the cart until payment actually succeeds — the CheckoutReturn
          // handler clears it on the `?checkout=success` redirect, so a cancel
          // at Stripe leaves the cart intact.
          window.location.href = url;
        }
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
  }, [step]);

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
    "mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";
  const primary =
    "w-full bg-accent text-accent-foreground font-serif font-semibold px-4 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card p-6 shadow-2xl border border-border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-primary">Checkout</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        {step === "email" && (
          <form onSubmit={submitEmail} className="space-y-3">
            <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">Enter the code we emailed to {email}.</p>
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
            <div>
              <label className="text-sm font-medium text-foreground">Your name (optional)</label>
              <input
                className={input}
                placeholder="Shown to the recipient as “from …”"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank and we&rsquo;ll use your account name or email.
              </p>
            </div>
            <div className="bg-muted p-3 text-sm text-muted-foreground">
              Trump Account contribution:{" "}
              <span className="font-semibold text-foreground">{formatCents(trumpTotal)}</span>
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
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
          <p className="py-6 text-center text-sm text-muted-foreground">Redirecting you to secure payment…</p>
        )}

        {step === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <button className={primary} onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {error && step !== "error" && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
