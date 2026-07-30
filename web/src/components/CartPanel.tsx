import { useCart } from "../lib/cart";
import { formatCents, processingFeeCents } from "../lib/format";

const DELIVERY_LABEL: Record<string, string> = {
  EMAIL: "Email",
  SMS: "Text",
  SELF: "Share myself",
};

export function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const { lines, remove, totalCents } = useCart();

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
        Your cart is empty — add a gift to get started.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Cart</h2>
      <ul className="divide-y divide-slate-100">
        {lines.map((l) => {
          const trump = Math.round((l.totalAmount * l.trumpPercent) / 100);
          const gift = l.totalAmount - trump;
          return (
            <li key={l.id} className="flex items-start justify-between py-3">
              <div className="text-sm">
                <div className="font-medium">
                  {formatCents(l.totalAmount)} gift{l.recipientName ? ` for ${l.recipientName}` : ""}
                </div>
                <div className="text-slate-500">
                  {l.trumpPercent}% Trump ({formatCents(trump)})
                  {l.trumpPercent < 100 && <> · Gift card {formatCents(gift)}</>} ·{" "}
                  {DELIVERY_LABEL[l.deliveryMethod]}
                </div>
              </div>
              <button
                onClick={() => remove(l.id)}
                className="ml-4 text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      {(() => {
        const fee = processingFeeCents(totalCents, lines.length);
        return (
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCents(totalCents)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Processing fee</span>
              <span>{formatCents(fee)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{formatCents(totalCents + fee)}</span>
            </div>
          </div>
        );
      })()}
      <button
        onClick={onCheckout}
        className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Checkout
      </button>
    </div>
  );
}
