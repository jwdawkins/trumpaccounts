import { useParams } from "react-router-dom";

// Recipient claim flow (handoff §7.2). No account required.
// M3 fills in: gift details, gift-card selection, Trump Account linking
// (QR upload / MMS), AWAITING_TRUMP_ACCOUNT path, status checklist.
export function ClaimLanding() {
  const { token } = useParams();
  return (
    <section>
      <h1 className="text-2xl font-semibold">You&rsquo;ve received a gift</h1>
      <p className="mt-2 text-slate-600">
        Claim flow arrives in M3. Claim token:{" "}
        <code className="rounded bg-slate-200 px-1 py-0.5 text-sm">
          {token ? `${token.slice(0, 6)}…` : "(none)"}
        </code>
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
        Claim &amp; Trump Account linking — coming in M3
      </div>
    </section>
  );
}
