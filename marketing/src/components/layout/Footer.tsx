import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-[#060D18] text-white py-16 mt-0 border-t border-accent">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded border-2 border-accent flex items-center justify-center text-accent font-serif font-bold text-xl">
                T
              </div>
              <span className="font-serif font-bold text-xl tracking-tight text-white flex flex-col leading-tight">
                Trump Account
                <span className="text-xs font-sans font-medium text-accent tracking-widest uppercase">Gift Cards</span>
              </span>
            </Link>
            <p className="text-sm text-white/70 mb-6 max-w-xs leading-relaxed">
              A premium financial product helping American families invest in their children's future.
            </p>
          </div>
          
          <div>
            <h4 className="font-serif font-semibold mb-4 text-accent uppercase tracking-wider text-sm">Product</h4>
            <ul className="space-y-3 text-sm text-[#F5F0E8]">
              <li><Link href="/shop" className="hover:text-accent transition-colors">Shop Cards</Link></li>
              <li><Link href="/how-it-works" className="hover:text-accent transition-colors">How It Works</Link></li>
              <li><Link href="/about-trump-accounts" className="hover:text-accent transition-colors">About Trump Accounts</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-serif font-semibold mb-4 text-accent uppercase tracking-wider text-sm">Support</h4>
            <ul className="space-y-3 text-sm text-[#F5F0E8]">
              <li><Link href="/faq" className="hover:text-accent transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-accent transition-colors">Contact Us</Link></li>
              <li><a href="mailto:support@trumpaccountgiftcards.com" className="hover:text-accent transition-colors">support@trumpaccountgiftcards.com</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-serif font-semibold mb-4 text-accent uppercase tracking-wider text-sm">Stay Updated</h4>
            <p className="text-sm text-[#F5F0E8] mb-4 leading-relaxed">Join our waitlist to be notified when we launch in July 2026.</p>
          </div>
        </div>
        
        <div className="h-px bg-accent/20 my-8" />
        
        <div className="text-xs text-white/50 space-y-4 max-w-4xl font-sans">
          <p>Trump Account Gift Cards is a product of WD Fintech, LLC.</p>
          <p>Not affiliated with, endorsed by, or sponsored by the Trump Organization, the Trump family, or the U.S. government.</p>
          <p>'Trump Account' refers to the Section 530A individual retirement account established by the One Big Beautiful Bill Act.</p>
          <p>Investment projections are illustrative only, based on historical averages. Past performance does not guarantee future results. Investments are subject to market risk.</p>
          <p className="pt-4">&copy; {new Date().getFullYear()} WD Fintech, LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}