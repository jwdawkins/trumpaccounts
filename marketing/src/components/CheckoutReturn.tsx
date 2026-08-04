import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useCart } from "@/lib/cart";
import { OrderView } from "@/components/OrderView";

/**
 * Handles the post-Stripe redirect. The checkout handler sends buyers back to
 * `${WEB_BASE_URL}/?checkout=success&order=<id>` (or `?checkout=cancel`). We read
 * those params on mount, show a confirmation overlay, clear the cart on success
 * (kept until now so a cancel preserves it), and strip the params from the URL so
 * a refresh doesn't re-trigger.
 */
export function CheckoutReturn() {
  const { clear } = useCart();
  const [state, setState] = useState<{ status: "success" | "cancel"; order?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout !== "success" && checkout !== "cancel") return;
    setState({ status: checkout, order: params.get("order") ?? undefined });
    if (checkout === "success") clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  const dismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("order");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    setState(null);
  };

  const success = state.status === "success";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-primary border border-accent/30 shadow-2xl p-8 text-center text-white my-8">
        {success ? (
          <>
            <CheckCircle2 className="mx-auto text-accent" size={56} strokeWidth={1.5} />
            <h2 className="mt-4 text-2xl font-serif font-bold text-accent">Your gift is confirmed</h2>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Thank you — your gift is confirmed. Once the recipient claims the gift, we&rsquo;ll ensure their Trump
              Account is funded and then they can redeem their gift card.
            </p>
            {state.order && (
              <div className="mt-5">
                <OrderView orderId={state.order} />
              </div>
            )}
            <p className="mt-5 text-xs text-white/40">
              A confirmation email with a link to check your gift status is on its way.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto text-white/50" size={56} strokeWidth={1.5} />
            <h2 className="mt-4 text-2xl font-serif font-bold text-white">Checkout canceled</h2>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              No charge was made and your cart is still saved — you can pick up right where you left off whenever
              you&rsquo;re ready.
            </p>
          </>
        )}
        <button
          onClick={dismiss}
          className="mt-6 w-full py-3 bg-accent text-accent-foreground font-serif font-bold transition-opacity hover:opacity-90"
        >
          {success ? "Done" : "Back to shopping"}
        </button>
      </div>
    </div>
  );
}
