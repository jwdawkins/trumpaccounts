import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { api, OrderSummary } from "../../lib/api";
import { formatCents } from "../../lib/format";

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-blue-50 text-blue-700",
  Pending: "bg-amber-50 text-amber-700",
  Complete: "bg-green-50 text-green-700",
  Unverified: "bg-red-50 text-red-700",
  Processing: "bg-slate-100 text-slate-600",
  Refunded: "bg-slate-100 text-slate-600",
  Voided: "bg-slate-100 text-slate-500",
  Expired: "bg-slate-100 text-slate-500",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-slate-100"}`}>
      {status}
    </span>
  );
}

export function History() {
  const { email, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !email) return;
    api
      .listOrders()
      .then((r) => setOrders(r.orders))
      .catch((e) => setError((e as Error).message));
  }, [authLoading, email]);

  async function downloadCert(cardId: string) {
    try {
      const blob = await api.downloadCertificate(cardId);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!authLoading && !email) {
    return <p className="text-slate-600">Sign in from checkout to view your gift history.</p>;
  }
  if (error) return <p className="text-red-600">{error}</p>;
  if (!orders) return <p className="text-slate-500">Loading…</p>;
  if (orders.length === 0) return <p className="text-slate-600">No orders yet.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your gifts</h1>
      {orders.map((o) => (
        <div key={o.orderId} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
            <span>{new Date(o.createdAt).toLocaleDateString()}</span>
            <span>
              {formatCents(o.totalAmount)} · {o.status}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {o.cards.map((c) => (
              <li key={c.cardId} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatCents(c.totalAmount)}
                  {c.recipientName ? ` · ${c.recipientName}` : ""} · {c.trumpPercent}% Trump
                </span>
                <div className="flex items-center gap-3">
                  {c.deliveryMethod === "SELF" && c.status !== "Processing" && (
                    <button
                      onClick={() => downloadCert(c.cardId)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Download certificate
                    </button>
                  )}
                  <Badge status={c.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
