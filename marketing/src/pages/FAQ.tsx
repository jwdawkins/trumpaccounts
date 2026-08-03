import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function FAQ() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        <div className="bg-primary text-white py-16 md:py-24 border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-white">Frequently Asked Questions</h1>
            <p className="text-xl text-[#F5F0E8] font-light leading-relaxed">
              Everything you need to know about purchasing, using, and managing Trump Account Gift Cards.
            </p>
          </div>
        </div>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <FAQAccordion />
          </div>
        </section>

        <section className="py-24 bg-muted border-t border-border">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
            <h2 className="text-3xl font-serif font-bold text-primary mb-6">Still have questions?</h2>
            <p className="text-lg text-foreground/80 mb-10 leading-relaxed">
              Our support team is here to help. If you can't find the answer you're looking for, don't hesitate to reach out.
            </p>
            <Button asChild size="lg" className="bg-primary text-white hover:bg-primary/90 h-14 px-10 rounded-none font-bold uppercase tracking-widest font-sans">
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}