import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, ChevronRight, Gift, PiggyBank, ShieldCheck, TrendingUp, CreditCard } from "lucide-react";
import { OCCASIONS } from "@/lib/occasions";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="bg-primary text-white relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10 max-w-[1200px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch min-h-[90vh]">
              {/* Left: Copy */}
              <div className="flex flex-col justify-center py-24 md:py-32 pr-0 lg:pr-16">
                <div className="inline-block border border-accent/40 text-accent font-sans font-bold uppercase tracking-[0.2em] text-xs px-4 py-1 mb-8 bg-accent/5 self-start">
                  A NEW WAY TO GIVE — FOR AMERICA'S CHILDREN
                </div>
                <h1 className="font-serif text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-bold mb-8 leading-[1.1] text-white">
                  The Gift Card That <span className="text-accent italic block mt-2">Builds Their Future</span>
                </h1>
                <div className="w-24 h-1 bg-accent mb-8" />
                <p className="text-xl text-[#F5F0E8] mb-12 leading-relaxed max-w-xl font-light">
                  Give a gift they can spend today — and invest for a lifetime. Trump Account Gift Cards split your gift between a gift card they can spend and a child's tax-advantaged Trump Account.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-10 h-16 rounded-none font-bold tracking-wide uppercase font-serif">
                    <Link href="/shop">Build a Gift Card</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-10 h-16 rounded-none font-bold tracking-wide uppercase font-serif bg-transparent">
                    <a href="#how-it-works">Learn How It Works</a>
                  </Button>
                </div>
                {/* Spokesperson mini-callout */}
                <div className="mt-12 flex items-center gap-4 border-t border-white/10 pt-8">
                  <img
                    src="/images/shannon-portrait.jpg"
                    alt="T.W. Shannon"
                    className="w-14 h-14 rounded-full object-cover object-top border-2 border-accent/50"
                  />
                  <div>
                    <div className="text-white/50 text-xs uppercase tracking-widest font-semibold font-sans mb-1">Featured Spokesperson</div>
                    <div className="font-serif text-white font-bold">T.W. Shannon</div>
                    <div className="text-accent/80 text-xs font-sans">Former Speaker · USDA Senior Advisor</div>
                  </div>
                </div>
              </div>
              {/* Right: Shannon photo */}
              <div className="hidden lg:block relative self-stretch">
                <img
                  src="/images/shannon-portrait.jpg"
                  alt="T.W. Shannon — Spokesperson for Trump Account Gift Cards"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="border-l-2 border-accent pl-4">
                    <p className="font-serif text-white text-lg italic leading-snug">
                      "Every child in America deserves a head start on the American Dream."
                    </p>
                    <div className="mt-3 text-accent text-xs uppercase tracking-widest font-semibold font-sans">T.W. Shannon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-24 bg-background scroll-mt-24">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary text-center mb-16">How It Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 text-accent shadow-lg border-2 border-accent/20">
                  <Gift size={32} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary mb-4">Step 1: Choose & Buy</h3>
                <p className="text-foreground/80 leading-relaxed text-lg">
                  Pick amount and split, add a message, and purchase online securely.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 text-accent shadow-lg border-2 border-accent/20">
                  <TrendingUp size={32} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary mb-4">Step 2: Verify & Transfer</h3>
                <p className="text-foreground/80 leading-relaxed text-lg">
                  Recipient verifies their Trump Account and the invested portion transfers to their Section 530A account.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 text-accent shadow-lg border-2 border-accent/20">
                  <CreditCard size={32} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary mb-4">Step 3: Redeem & Spend</h3>
                <p className="text-foreground/80 leading-relaxed text-lg">
                  Recipient redeems their gift card and it's ready to spend.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY THIS GIFT IS DIFFERENT */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary text-center mb-16">Why This Gift Is Different</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-10 border border-border shadow-sm flex gap-6 items-start">
                <div className="text-primary mt-1">
                  <TrendingUp size={36} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-primary mb-3">A Gift That Grows</h3>
                  <p className="text-foreground/80 text-lg leading-relaxed">Unlike a regular gift card, part is invested in the child's future.</p>
                </div>
              </div>
              <div className="bg-white p-10 border border-border shadow-sm flex gap-6 items-start">
                <div className="text-primary mt-1">
                  <ShieldCheck size={36} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-primary mb-3">Easy for Everyone</h3>
                  <p className="text-foreground/80 text-lg leading-relaxed">No brokerage accounts. Just buy a card — we handle the rest.</p>
                </div>
              </div>
              <div className="bg-white p-10 border border-border shadow-sm flex gap-6 items-start">
                <div className="text-primary mt-1">
                  <PiggyBank size={36} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-primary mb-3">The Whole Family Can Contribute</h3>
                  <p className="text-foreground/80 text-lg leading-relaxed">Grandparents, aunts, uncles, family friends can all give.</p>
                </div>
              </div>
              <div className="bg-white p-10 border border-border shadow-sm flex gap-6 items-start">
                <div className="text-primary mt-1">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-primary mb-3">Tax-Advantaged Growth</h3>
                  <p className="text-foreground/80 text-lg leading-relaxed">Invested in U.S. stock market index funds, grows tax-deferred.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT IS A TRUMP ACCOUNT? */}
        <section id="trump-accounts" className="py-24 bg-primary text-white border-y border-accent/30 scroll-mt-24">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-accent mb-8">What Is a Trump Account?</h2>
                <ul className="space-y-6 text-lg text-[#F5F0E8] font-light">
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
                    <span>New tax-advantaged investment account for children under 18</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
                    <span>Created by the One Big Beautiful Bill Act, signed July 4, 2025</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
                    <span>Families can contribute up to $5,000 per year</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
                    <span>Invested in U.S. stock market index funds (S&P 500)</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-accent mt-2.5 shrink-0" />
                    <span>At 18, the account transfers to the child's control to manage and use for their future goals</span>
                  </li>
                </ul>
                <div className="mt-10">
                  <Button asChild className="bg-transparent border border-accent text-accent hover:bg-accent/10 rounded-none h-14 px-8 font-bold tracking-wide uppercase font-sans">
                    <a href="https://trumpaccounts.gov" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      Learn More at TrumpAccounts.gov <ChevronRight size={18} />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="relative border-[12px] border-accent/20 p-8 flex flex-col justify-center items-center text-center bg-primary/50 aspect-square max-w-md mx-auto">
                <ShieldCheck size={80} className="text-accent mb-6" />
                <h3 className="font-serif text-3xl font-bold text-white mb-4 uppercase tracking-widest leading-tight">Official<br/>Section 530A</h3>
                <div className="w-16 h-1 bg-accent mb-4" />
                <p className="text-accent tracking-widest font-semibold uppercase text-sm">Individual Retirement Account</p>
              </div>
            </div>
          </div>
        </section>

        {/* T.W. SHANNON SPOKESPERSON SECTION */}
        <section className="py-24 bg-background relative">
          <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0iIzE2MjkyNSIvPjwvc3ZnPg==')]" />
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px] relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-center">
              <div className="lg:col-span-2">
                <div className="relative">
                  <div className="absolute -inset-3 border-2 border-accent/30 pointer-events-none" />
                  <div className="absolute -inset-6 border border-accent/10 pointer-events-none" />
                  <img
                    src="/images/shannon-portrait.jpg"
                    alt="T.W. Shannon — Spokesperson, Trump Account Gift Cards"
                    className="w-full aspect-[3/4] object-cover object-top"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6 pt-16">
                    <div className="font-serif text-white font-bold text-lg">T.W. Shannon</div>
                    <div className="text-accent text-xs uppercase tracking-widest font-semibold mt-1">Spokesperson · Trump Account Gift Cards</div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-3 space-y-10">
                <div className="relative">
                  <span className="absolute -top-10 -left-6 text-7xl text-accent/30 font-serif leading-none">"</span>
                  <blockquote className="font-serif text-3xl md:text-4xl text-primary font-bold leading-tight italic relative z-10">
                    Every child in America deserves a head start on the American Dream. Trump Account Gift Cards make it simple for families to invest in their children's future — one gift at a time.
                  </blockquote>
                  <div className="mt-6 text-lg font-bold text-accent uppercase tracking-widest font-sans">
                    — T.W. Shannon
                  </div>
                </div>
                
                <p className="text-foreground/80 text-lg leading-relaxed">
                  T.W. Shannon is the spokesperson for Trump Account Gift Cards. He is a former Speaker of the Oklahoma House of Representatives — the first African American and Chickasaw to hold that office. Shannon is an attorney, banker, and serves as Senior Advisor for Rural Prosperity at the U.S. Department of Agriculture under President Trump. He is running for Lieutenant Governor of Oklahoma in 2026.
                </p>

                <div className="bg-primary p-8 border-l-4 border-accent">
                  <div className="relative">
                    <span className="absolute -top-4 -left-2 text-4xl text-accent/40 font-serif leading-none">"</span>
                    <blockquote className="font-serif text-xl text-white italic relative z-10 pl-6">
                      As a banker, I've seen firsthand how early financial planning changes lives. As a father, I know that the best gift you can give a child isn't something they'll outgrow — it's something that grows with them.
                    </blockquote>
                    <div className="mt-4 pl-6 text-sm font-bold text-accent uppercase tracking-widest font-sans">
                      — T.W. Shannon
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PERFECT FOR */}
        <section className="py-24 bg-primary text-white border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-accent text-center mb-16">The Perfect Gift for Every Occasion</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {OCCASIONS.map((occasion) => (
                <Link
                  key={occasion.slug}
                  href={`/shop?occasion=${occasion.slug}`}
                  className="border border-accent/30 bg-primary p-8 flex flex-col items-center justify-center text-center group hover:bg-accent/5 hover:border-accent transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full border border-accent text-accent flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    <Gift size={24} />
                  </div>
                  <h3 className="font-serif font-bold text-xl text-white group-hover:text-accent transition-colors">{occasion.label}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 bg-background scroll-mt-24">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary text-center mb-16">Frequently Asked Questions</h2>
            <FAQAccordion />
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}