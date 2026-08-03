import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CardConfigurator } from "@/components/CardConfigurator";
import { WaitlistForm } from "@/components/WaitlistForm";

export default function Shop() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        <div className="bg-primary text-white py-16 md:py-24 border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-white">Shop Gift Cards</h1>
            <p className="text-xl text-[#F5F0E8] font-light leading-relaxed">
              Customize the perfect gift. Choose the total value, then decide how much to invest for their future and how much they can spend today.
            </p>
          </div>
        </div>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <CardConfigurator />
          </div>
        </section>

        <section className="py-24 bg-muted border-t border-border">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-[1200px] mx-auto">
              <div className="max-w-xl">
                <div className="inline-block border border-primary/20 text-primary font-sans font-bold uppercase tracking-[0.2em] text-xs px-4 py-1 mb-6 bg-primary/5">
                  LAUNCHING JULY 2026
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6">Coming Soon</h2>
                <p className="text-lg text-foreground/80 mb-6 leading-relaxed">
                  We're currently finalizing our banking partnerships to bring you the best possible experience. Trump Account Gift Cards will be available for purchase soon.
                </p>
                <p className="text-lg text-foreground/80 mb-8 leading-relaxed">
                  Join our waitlist to be notified the moment we launch and receive early access to our initial card run.
                </p>
              </div>
              <div>
                <WaitlistForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}