import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CreditCard, Landmark, Send, Sparkles } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        <div className="bg-primary text-white py-16 md:py-24 border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-white">How It Works</h1>
            <p className="text-xl text-[#F5F0E8] font-light leading-relaxed">
              A simple, secure process that transforms an ordinary gift into a lifelong asset.
            </p>
          </div>
        </div>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <div className="space-y-32">
              {/* Step 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="order-2 md:order-1">
                  <div className="w-16 h-16 bg-primary text-accent border-2 border-accent/20 flex items-center justify-center text-2xl font-serif font-bold mb-8">1</div>
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-6">You customize the gift</h2>
                  <p className="text-lg text-foreground/80 mb-8 leading-relaxed">
                    Select a gift card denomination ($25 to $500). Then, choose the investment split. 
                    You decide what percentage of the card's value goes into the child's Trump Account (tax-advantaged investment) 
                    and what percentage goes onto the prepaid Visa/Mastercard for immediate spending.
                  </p>
                  <ul className="space-y-4 text-foreground/80 font-medium">
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Flexible amounts for any budget</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Custom splits (10%, 20%, 25%, 50%, 100%)</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Digital or physical card delivery</li>
                  </ul>
                </div>
                <div className="order-1 md:order-2 flex justify-center">
                  <div className="bg-white p-12 border border-border shadow-sm w-full aspect-square flex items-center justify-center max-w-md">
                    <CreditCard className="w-32 h-32 text-primary" strokeWidth={1} />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="flex justify-center">
                  <div className="bg-white p-12 border border-border shadow-sm w-full aspect-square flex items-center justify-center max-w-md">
                    <Send className="w-32 h-32 text-primary" strokeWidth={1} />
                  </div>
                </div>
                <div>
                  <div className="w-16 h-16 bg-primary text-accent border-2 border-accent/20 flex items-center justify-center text-2xl font-serif font-bold mb-8">2</div>
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-6">They activate online</h2>
                  <p className="text-lg text-foreground/80 mb-8 leading-relaxed">
                    The recipient's parent or guardian scans the QR code on the card or visits our activation site. 
                    If they already have a Trump Account, they simply log in. If not, we guide them through a secure, 
                    5-minute process to establish one.
                  </p>
                  <ul className="space-y-4 text-foreground/80 font-medium">
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Quick, secure identity verification</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> No hidden fees for account setup</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Parent/guardian maintains control</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="order-2 md:order-1">
                  <div className="w-16 h-16 bg-primary text-accent border-2 border-accent/20 flex items-center justify-center text-2xl font-serif font-bold mb-8">3</div>
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-6">Funds are split automatically</h2>
                  <p className="text-lg text-foreground/80 mb-8 leading-relaxed">
                    Upon activation, the magic happens. The designated investment portion is securely transferred 
                    to the Trump Account where it can grow tax-free. The remaining balance instantly becomes available 
                    on the prepaid card to spend anywhere Visa/Mastercard is accepted.
                  </p>
                  <ul className="space-y-4 text-foreground/80 font-medium">
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Instant availability for the spending portion</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> Automatic transfer to the investment portfolio</li>
                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-none bg-accent" /> You get a notification when they activate</li>
                  </ul>
                </div>
                <div className="order-1 md:order-2 flex justify-center">
                  <div className="bg-primary p-12 border border-accent/30 shadow-xl w-full aspect-square flex items-center justify-center relative max-w-md">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')] opacity-10" />
                    <Landmark className="w-32 h-32 text-accent relative z-10" strokeWidth={1} />
                    <Sparkles className="w-12 h-12 text-white absolute top-1/4 right-1/4 z-10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-primary text-center border-y border-accent/30 relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-white mb-10">Ready to start gifting smarter?</h2>
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-12 h-16 rounded-none font-bold uppercase tracking-widest font-sans">
              <Link href="/shop">Design a Gift Card</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}