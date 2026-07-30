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

function GiftCardPicker({ token, onDone }: { token: string; onDone: () => void }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [choice, setChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    claimApi.catalog(token).then((r) => setProducts(r.products)).catch((e) => setError((e as Error).message));
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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">1. Choose your gift card</h2>
      <div className="mt-3 space-y-2">
        {products.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input type="radio" name="product" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} />
            {p.name}
          </label>
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

function StatusChecklist({ details }: { details: ClaimDetails }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Status</h2>
      <ul className="mt-3 space-y-2">
        {details.checklist.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                s.done ? "bg-green-500 text-white" : "border border-slate-300 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={s.done ? "text-slate-900" : "text-slate-500"}>{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
