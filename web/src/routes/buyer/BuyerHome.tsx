// Buyer storefront (handoff §7.1). No login required to browse/build a cart.
// M2 fills in: cart, per-card Trump split, gift-card selection, checkout.
export function BuyerHome() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Give a gift that grows</h1>
      <p className="mt-2 max-w-prose text-slate-600">
        Split a gift between a contribution to a child&rsquo;s Trump Account and
        an optional retail gift card. Storefront &amp; checkout arrive in M2.
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
        Storefront / cart — coming in M2
      </div>
    </section>
  );
}
