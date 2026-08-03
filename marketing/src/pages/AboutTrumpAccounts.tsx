import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BookOpen, Briefcase, GraduationCap, Home as HomeIcon, TrendingUp } from "lucide-react";

export default function AboutTrumpAccounts() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        <div className="bg-primary text-white py-16 md:py-24 border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none bg-white/5 text-accent text-sm font-medium mb-6 border border-accent/20 uppercase tracking-widest font-sans">
              <BookOpen className="w-4 h-4" />
              <span>Educational Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-white">Understanding Trump Accounts</h1>
            <p className="text-xl text-[#F5F0E8] leading-relaxed font-light max-w-3xl mx-auto">
              Everything you need to know about the tax-advantaged investment vehicle designed to give the next generation a financial head start.
            </p>
          </div>
        </div>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <div className="prose prose-lg prose-headings:text-primary prose-a:text-accent max-w-none">
              <h2 className="text-3xl font-serif font-bold mb-6 text-primary">What is a Trump Account?</h2>
              <p className="text-foreground/80 leading-relaxed mb-8">
                Established under Section 530A of the Internal Revenue Code, a Trump Account is a specialized tax-advantaged investment vehicle designed exclusively for minors. Similar in structure to a Roth IRA or a 529 College Savings Plan, but with broader utility, it allows parents, grandparents, and loved ones to invest money that grows completely tax-free over a child's early life.
              </p>

              <div className="bg-white p-8 md:p-10 border border-border my-12 shadow-sm">
                <h3 className="text-2xl font-serif font-bold mb-6 mt-0 text-primary">The Core Benefits</h3>
                <ul className="space-y-6 m-0 p-0 list-none text-foreground/80">
                  <li className="flex items-start gap-4">
                    <TrendingUp className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                    <span><strong className="text-primary font-bold">Tax-Free Growth:</strong> Investments grow without being hindered by annual capital gains or dividend taxes.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <HomeIcon className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                    <span><strong className="text-primary font-bold">Tax-Free Withdrawals:</strong> Funds can be withdrawn tax-free for qualified life-starting expenses.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <Briefcase className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                    <span><strong className="text-primary font-bold">Broad Utility:</strong> Unlike 529 plans, funds aren't restricted just to education.</span>
                  </li>
                </ul>
              </div>

              <h2 className="text-3xl font-serif font-bold mb-6 text-primary">Qualified Expenses</h2>
              <p className="text-foreground/80 leading-relaxed mb-6">
                The defining feature of a Trump Account is how the money can be used. When the child reaches adulthood, they can withdraw funds completely tax-free for "qualified life-starting expenses," which generally include:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
                <div className="border border-border bg-white p-6 text-center shadow-sm">
                  <GraduationCap className="w-10 h-10 mx-auto text-accent mb-4" />
                  <h4 className="font-serif font-bold text-primary m-0 text-lg">Higher Education</h4>
                  <p className="text-sm text-foreground/70 mt-2">Tuition, books, and living expenses for college or trade school.</p>
                </div>
                <div className="border border-border bg-white p-6 text-center shadow-sm">
                  <HomeIcon className="w-10 h-10 mx-auto text-accent mb-4" />
                  <h4 className="font-serif font-bold text-primary m-0 text-lg">First Home</h4>
                  <p className="text-sm text-foreground/70 mt-2">Down payment and closing costs on a primary residence.</p>
                </div>
                <div className="border border-border bg-white p-6 text-center shadow-sm">
                  <Briefcase className="w-10 h-10 mx-auto text-accent mb-4" />
                  <h4 className="font-serif font-bold text-primary m-0 text-lg">Starting a Business</h4>
                  <p className="text-sm text-foreground/70 mt-2">Initial capital to launch a qualified small business.</p>
                </div>
              </div>

              <h2 className="text-3xl font-serif font-bold mb-6 text-primary">Contribution Limits & Rules</h2>
              <p className="text-foreground/80 leading-relaxed mb-6">
                Current IRS regulations permit up to <strong className="text-primary">$5,000 per year</strong> to be contributed to a single child's Trump Account. This is an aggregate limit—meaning contributions from parents, grandparents, and gift cards all count toward this $5,000 annual maximum.
              </p>
              <p className="text-foreground/80 leading-relaxed mb-10">
                Contributions are made with after-tax dollars (they are not tax-deductible when made), but the power of the account lies in the decades of tax-free compound growth.
              </p>

              <div className="bg-primary text-white p-8 md:p-12 border border-accent/30 shadow-xl">
                <h3 className="text-accent text-3xl font-serif font-bold mb-4 mt-0">Why Gift Cards?</h3>
                <p className="text-[#F5F0E8] leading-relaxed m-0 mb-8 font-light text-lg">
                  Historically, contributing to a child's investment account required knowing their Social Security Number and specific account routing details—making it difficult for extended family to contribute. Trump Account Gift Cards solve this by acting as a secure intermediary. You buy the card, and the parents securely route the funds when they activate it.
                </p>
                <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 px-8 font-bold uppercase tracking-widest font-sans rounded-none">
                  <Link href="/shop">Shop Gift Cards</Link>
                </Button>
              </div>
              
              <p className="text-xs text-foreground/50 mt-16 pt-8 border-t border-border font-sans leading-relaxed">
                Disclaimer: The information provided on this page is for educational purposes only and does not constitute financial, legal, or tax advice. Please consult with a qualified professional regarding your specific situation. Trump Account regulations are subject to change. Visit trumpaccounts.gov for official IRS guidelines.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}