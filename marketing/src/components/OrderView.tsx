import { useEffect, useState } from "react";
import { Download, Mail, Loader2, Check } from "lucide-react";
import { api, downloadAuthedFile, type OrderCard, type OrderDetail } from "@/lib/api";
import { formatCents } from "@/lib/format";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function prettyDate(d?: string): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function deliveryLine(c: OrderCard): string {
  if (c.deliveryMethod === "SELF")
    return "You chose to deliver this yourself — download the certificate to print/share, or email it below. You're responsible for getting it to the recipient.";
  const who = c.deliveryMethod === "EMAIL" ? c.recipientEmail : c.recipientPhone;
  const channel = c.deliveryMethod === "EMAIL" ? "email" : "text";
  const when = c.sendDate ? ` on ${prettyDate(c.sendDate)}` : " shortly";
  return `${c.recipientName ? `${c.recipientName} gets theirs` : "The recipient gets theirs"} by ${channel}${
    who ? ` (${who})` : ""
  }${when}.`;
}

/** One card's row: summary, delivery detail, and per-card actions. */
function CardRow({ card, busy, onDownload }: { card: OrderCard; busy: string | null; onDownload: (p: string, f: string) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const certPath = api.cardCertPath(card.cardId);

  const sendEmail = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setErr("Enter a valid email.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await api.sendGiftEmail(card.cardId, email.trim());
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-white/15 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-white">
          {formatCents(card.totalAmount)}
          {card.brandName ? <span className="text-white/50 font-normal"> · {card.brandName}</span> : ""}
        </div>
        <span className="text-[11px] uppercase tracking-wider text-accent">{card.status}</span>
      </div>
      <p className="text-xs text-white/60 mt-2 leading-relaxed">{deliveryLine(card)}</p>

      {card.hasCertificate && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onDownload(certPath, `gift-${card.cardId}.pdf`)}
            disabled={busy === certPath}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent border border-accent/40 px-3 py-1.5 hover:bg-accent/10 disabled:opacity-50"
          >
            {busy === certPath ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
          </button>
        </div>
      )}

      {card.deliveryMethod === "SELF" && card.hasCertificate && (
        <div className="mt-3">
          {sent ? (
            <p className="text-xs text-green-300 inline-flex items-center gap-1.5">
              <Check size={14} /> Sent to {email.trim()}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email the gift to…"
                className="flex-1 min-w-[180px] bg-transparent border border-white/25 text-white text-sm py-1.5 px-2 focus:border-accent focus:outline-none placeholder:text-white/30"
              />
              <button
                onClick={sendEmail}
                disabled={sending}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-accent-foreground px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Email it
              </button>
            </div>
          )}
          {err && <p className="text-xs text-red-300/80 mt-1">{err}</p>}
        </div>
      )}
    </div>
  );
}

export function OrderView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getOrder(orderId)
      .then((o) => live && setOrder(o))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [orderId]);

  const download = (path: string, filename: string) => {
    setBusy(path);
    downloadAuthedFile(path, filename)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  };

  if (error) return <p className="text-sm text-white/60">We couldn&rsquo;t load the order details ({error}).</p>;
  if (!order) return <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading your gift…</p>;

  const multi = order.cards.length > 1;
  const anySelf = order.cards.some((c) => c.deliveryMethod === "SELF");

  return (
    <div className="space-y-3 text-left">
      {order.cards.map((c) => (
        <CardRow key={c.cardId} card={c} busy={busy} onDownload={download} />
      ))}

      {multi && anySelf && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-white/40">Download all {order.cards.length}:</span>
          <button
            onClick={() => download(api.orderCombinedPdfPath(orderId), `gifts-${orderId}.pdf`)}
            disabled={busy === api.orderCombinedPdfPath(orderId)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent border border-accent/40 px-3 py-1.5 hover:bg-accent/10 disabled:opacity-50"
          >
            {busy === api.orderCombinedPdfPath(orderId) ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} One PDF
          </button>
          <button
            onClick={() => download(api.orderZipPath(orderId), `gifts-${orderId}.zip`)}
            disabled={busy === api.orderZipPath(orderId)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent border border-accent/40 px-3 py-1.5 hover:bg-accent/10 disabled:opacity-50"
          >
            {busy === api.orderZipPath(orderId) ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Zip
          </button>
        </div>
      )}
    </div>
  );
}
