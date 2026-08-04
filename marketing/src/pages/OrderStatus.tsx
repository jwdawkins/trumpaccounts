import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { OrderView } from "@/components/OrderView";

/** /orders/:id — buyer-facing gift status + management (linked from the summary email). */
export default function OrderStatus({ params }: { params: { id: string } }) {
  const id = params.id;
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      <main className="flex-1 bg-background">
        <section className="container mx-auto px-4 md:px-6 py-12 max-w-2xl">
          <div className="bg-primary text-white p-8 md:p-10 border border-accent/20 shadow-2xl">
            <h1 className="text-2xl font-serif font-bold text-accent">Your gift order</h1>
            <p className="text-xs uppercase tracking-wider text-white/40 mt-1 mb-6">
              Order <span className="font-mono normal-case text-white/60">{id}</span>
            </p>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              Once each recipient claims their gift, we&rsquo;ll ensure their Trump Account is funded and then they can
              redeem their gift card. Track status, download certificates, and manage delivery below.
            </p>
            <OrderView orderId={id} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
