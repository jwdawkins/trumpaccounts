import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GiftForm } from "../../components/GiftForm";
import { CartPanel } from "../../components/CartPanel";
import { CheckoutDialog } from "../../components/CheckoutDialog";
import { useCart } from "../../lib/cart";

// Buyer storefront (handoff §7.1) — browse & build a cart with no login;
// an account is created/entered only at checkout (D1).
export function BuyerHome() {
  const { add, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [params, setParams] = useSearchParams();
  const checkout = params.get("checkout");

  // Returning from Stripe: success clears the cart.
  useEffect(() => {
    if (checkout === "success") clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Give a gift that grows</h1>
        <p className="mt-1 max-w-prose text-slate-600">
          Split a gift between a contribution to a child&rsquo;s Trump Account and an optional
          retail gift card.
        </p>
      </section>

      {checkout === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Payment received — your gift links are on their way. See{" "}
          <a href="/history" className="font-medium underline">
            your history
          </a>
          .
          <button className="ml-3 text-green-700 underline" onClick={() => setParams({})}>
            dismiss
          </button>
        </div>
      )}
      {checkout === "cancel" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout canceled — your cart is still here.
          <button className="ml-3 underline" onClick={() => setParams({})}>
            dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <GiftForm onAdd={add} />
        <CartPanel onCheckout={() => setCheckingOut(true)} />
      </div>

      {checkingOut && <CheckoutDialog onClose={() => setCheckingOut(false)} />}
    </div>
  );
}
