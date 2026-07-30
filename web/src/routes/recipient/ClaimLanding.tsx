import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { claimApi, ClaimDetails, CatalogProduct } from "../../lib/claim";
import { decodeQrFromImage } from "../../lib/qr";
import { formatCents } from "../../lib/format";

// Recipient claim flow (handoff §7.2) — no account required. Claim-token auth.
export function ClaimLanding() {
  const { token = "" } = useParams();
  const [details, setDetails] = useState<ClaimDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setDetails(await claimApi.details(token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh while the backend is still working so the status advances live
  // (verifying → contributing → complete) instead of looking hung.
  useEffect(() => {
    if (!details || details.complete || !details.inProgress) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [details, refresh]);

  if (loading) return <p className="text-slate-500">Loading your gift…</p>;
  if (error || !details)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        This gift link is invalid or has expired.
      </div>
    );

  const linkingNeeded = details.state === "OPEN" || details.state === "AWAITING_TRUMP_ACCOUNT";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">You&rsquo;ve received a gift 🎁</h1>
        {details.recipientName && <p className="mt-1 text-slate-600">For {details.recipientName}</p>}
        {details.fromName && <p className="text-sm text-slate-500">A gift from {details.fromName}</p>}
        <p className="mt-4 text-4xl font-bold text-blue-600">{formatCents(details.amount)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {formatCents(details.trumpAmount)} to a Trump Account
          {details.giftCardAmount > 0 && <> · {formatCents(details.giftCardAmount)} gift card</>}
        </p>
        {details.message && (
          <p className="mt-4 italic text-slate-700">&ldquo;{details.message}&rdquo;</p>
        )}
      </section>

      {details.needsGiftCardSelection && (
        <GiftCardPicker token={token} onDone={refresh} />
      )}

      {!details.needsGiftCardSelection && linkingNeeded && (
        <TrumpLink token={token} state={details.state} onDone={refresh} />
      )}

      <StatusChecklist details={details} />
    </div>
  );
}

const TYPE_ORDER = ["gift_card", "prepaid_visa", "cash_out", "donation"];

function GiftCardPicker({ token, onDone }: { token: string; onDone: () => void }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [budgetCents, setBudgetCents] = useState(0);
  const [choice, setChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    claimApi
      .catalog(token)
      .then((r) => { setProducts(r.products); setBudgetCents(r.budgetCents); })
      .catch((e) => setError((e as Error).message));
  }, [token]);

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      await claimApi.select(token, choice);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Group by type, in a stable order.
  const groups = TYPE_ORDER.map((t) => ({
    type: t,
    label: products.find((p) => p.type === t)?.groupLabel ?? "",
    items: products.filter((p) => p.type === t),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">1. Choose how to receive {formatCents(budgetCents)}</h2>
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g.type}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
            <div className="mt-2 space-y-2">
              {g.items.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                    choice === p.id ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input type="radio" name="product" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} />
                  <span className="flex-1">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.deliveryNote}</span>
                  </span>
                  <span className="text-right text-xs">
                    <span className="font-medium text-slate-700">{formatCents(p.netCents)}</span>
                    {p.feeBearing && <span className="block text-[10px] text-amber-600">after fee</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={!choice || busy}
        className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Confirm selection"}
      </button>
    </section>
  );
}

function TrumpLink({ token, state, onDone }: { token: string; state: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  async function link(payload: string) {
    setBusy(true);
    setError(null);
    try {
      await claimApi.link(token, payload);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      let payload: string | null;
      try {
        payload = await decodeQrFromImage(file);
      } catch {
        setError("That image couldn't be opened (HEIC isn't supported). Export it as PNG/JPEG, or paste your link/code below.");
        return;
      }
      if (!payload) {
        setError("No QR code found in that image. Make sure the whole QR is visible and in focus, or paste your link/code below.");
        return;
      }
      await claimApi.link(token, payload);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      inputEl.value = ""; // allow re-selecting the same file after a fix
    }
  }

  async function noAccount() {
    setBusy(true);
    setError(null);
    try {
      await claimApi.noAccount(token);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitPaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasted.trim()) return;
    await link(pasted.trim());
  }

  const input =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">2. Link your Trump Account</h2>
      <p className="mt-1 text-sm text-slate-600">
        In your Trump Account app, tap <strong>Share link</strong> and paste it here.
      </p>

      <form onSubmit={submitPaste} className="mt-3 space-y-2">
        <input
          className={input}
          placeholder="Paste your Trump Account link"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !pasted.trim()}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "Link account"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs uppercase text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or upload a QR photo <span className="h-px flex-1 bg-slate-200" />
      </div>
      <label className="block cursor-pointer rounded-md border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500 hover:border-blue-400">
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        {busy ? "Working…" : "Choose a QR image"}
      </label>
      <p className="mt-1 text-xs text-slate-400">
        Works best with a plain QR. Stylized codes may not scan — pasting the link is most reliable.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {state === "OPEN" ? (
        <button onClick={noAccount} disabled={busy} className="mt-4 text-sm text-slate-500 hover:underline">
          Don&rsquo;t have a Trump Account yet?
        </button>
      ) : (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Saved — link your account here whenever you&rsquo;re ready. This page stays available.
        </p>
      )}
    </section>
  );
}

function StepIcon({ status }: { status: string }) {
  const base = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs";
  if (status === "done") return <span className={`${base} bg-green-500 text-white`}>✓</span>;
  if (status === "active")
    return <span className={`${base} border-2 border-blue-500 border-t-transparent animate-spin`} aria-label="in progress" />;
  if (status === "attention") return <span className={`${base} bg-amber-500 text-white`}>!</span>;
  return <span className={`${base} border border-slate-300 text-transparent`}>•</span>;
}

function StatusChecklist({ details }: { details: ClaimDetails }) {
  const textFor = (status: string) =>
    status === "done" ? "text-slate-900"
    : status === "active" ? "text-blue-700"
    : status === "attention" ? "text-amber-700"
    : "text-slate-400";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">{details.headline}</h2>
      <ul className="mt-4 space-y-3">
        {details.checklist.map((s) => (
          <li key={s.key} className="flex items-start gap-3 text-sm">
            <StepIcon status={s.status} />
            <div>
              <p className={`font-medium ${textFor(s.status)}`}>{s.label}</p>
              {s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}
              {s.rewardLink && (
                <a
                  href={s.rewardLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  Reveal your gift →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {details.inProgress && (
        <p className="mt-4 text-xs text-slate-400">This updates automatically — no need to refresh.</p>
      )}
    </section>
  );
}
