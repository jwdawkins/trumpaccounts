import { useCart } from "@/lib/cart";
import { formatCents, processingFeeCents } from "@/lib/format";

const DELIVERY_LABEL: Record<string, string> = {
  EMAIL: "Email",
  SMS: "Text",
  SELF: "Share myself",
};

export function CartPanel({ onCheckout }: { onCheckout: () => void }) {
  const { lines, remove, totalCents } = useCart();

  if (lines.length === 0) {
    return (
      <div className="border border-dashed border-border p-8 text-center text-muted-foreground bg-card">
        Your cart is empty — build a gift above and add it to get started.
      </div>
    );
  }

  const fee = processingFeeCents(totalCents, lines.length);

  return (
    <div className="border border-border bg-card p-6">
      <h2 className="mb-4 text-2xl font-serif font-bold text-primary">Cart</h2>
      <ul className="divide-y divide-border">
        {lines.map((l) => {
          const trump = Math.round((l.totalAmount * l.trumpPercent) / 100);
          const gift = l.totalAmount - trump;
          return (
            <li key={l.id} className="flex items-start justify-between py-3">
              <div className="text-sm">
                <div className="font-semibold text-foreground">
                  {formatCents(l.totalAmount)} gift
                  {l.brandName ? ` · ${l.brandName}` : ""}
                </div>
                <div className="text-muted-foreground">
                  {l.trumpPercent}% Trump Account ({formatCents(trump)})
                  {l.trumpPercent < 100 && <> · Spendable {formatCents(gift)}</>}
                </div>
                <div className="text-muted-foreground">
                  {l.verificationMode === "VERIFIED" && l.recipientName
                    ? `For ${l.recipientName}`
                    : "Open gift"}
                  {l.deliveryMethod ? ` · ${DELIVERY_LABEL[l.deliveryMethod] ?? l.deliveryMethod}` : ""}
                </div>
              </div>
              <button
                onClick={() => remove(l.id)}
                className="ml-4 text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCents(totalCents)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Processing fee</span>
          <span>{formatCents(fee)}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCents(totalCents + fee)}</span>
        </div>
      </div>
      <button
        onClick={onCheckout}
        className="mt-5 w-full bg-accent text-accent-foreground font-serif font-bold text-lg py-3 transition-opacity hover:opacity-90"
      >
        Checkout
      </button>
    </div>
  );
}
