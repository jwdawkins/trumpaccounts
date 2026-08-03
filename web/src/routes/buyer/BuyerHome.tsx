// Buyer purchasing now lives on the marketing storefront
// (trumpaccountgiftcards.com). This app keeps the authenticated buyer history,
// recipient claim, and admin flows; the gift-building storefront was retired.
const STOREFRONT_URL = "https://trumpaccountgiftcards.com/shop";

export function BuyerHome() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Give a gift that grows</h1>
        <p className="mt-1 max-w-prose text-slate-600">
          Building and buying gift cards now happens on our storefront.
        </p>
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-700">
          Head to the storefront to build a gift and check out.
        </p>
        <a
          href={STOREFRONT_URL}
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to the storefront
        </a>
        <p className="mt-4 text-sm text-slate-500">
          Already bought gifts?{" "}
          <a href="/history" className="font-medium underline">
            View your history
          </a>
          .
        </p>
      </div>
    </div>
  );
}
