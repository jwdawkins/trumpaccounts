import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { CartPanel } from "@/components/CartPanel";
import { CheckoutDialog } from "@/components/CheckoutDialog";

export function Header() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { lines } = useCart();

  // Single-page nav: every item jumps to a section on the home page. When already
  // on "/", scroll directly; from another route (e.g. /shop) the wouter Link takes
  // us home and App's ScrollToHash handles the scroll.
  const navLinks = [
    { href: "/#how-it-works", id: "how-it-works", label: "How It Works" },
    { href: "/#trump-accounts", id: "trump-accounts", label: "Trump Accounts" },
    { href: "/#faq", id: "faq", label: "FAQ" },
  ];

  const jumpTo = (id: string) => {
    if (location === "/") document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const CartButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={() => setCartOpen((o) => !o)}
      aria-label="Cart"
      className={`relative text-white/80 hover:text-accent transition-colors ${className}`}
    >
      <ShoppingCart size={22} />
      {lines.length > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[11px] font-bold leading-none">
          {lines.length}
        </span>
      )}
    </button>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-primary border-b border-white/10 py-4">
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded border-2 border-accent flex items-center justify-center text-accent font-serif font-bold text-xl bg-primary">
            T
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-white group-hover:text-accent transition-colors flex flex-col leading-tight">
            Trump Account
            <span className="text-xs font-sans font-medium text-accent tracking-widest uppercase">Gift Cards</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => jumpTo(link.id)}
                className="text-sm font-medium transition-colors hover:text-accent text-white/80"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <CartButton />
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none px-6 font-semibold">
              <Link href="/shop">Build a Gift Card</Link>
            </Button>
          </div>
        </nav>

        {/* Mobile: cart + menu toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <CartButton className="p-1" />
          <button
            className="p-2 text-white hover:text-accent transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-primary border-b border-white/10 shadow-lg py-4 px-4 flex flex-col gap-4 animate-in slide-in-from-top-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => {
                setIsMobileMenuOpen(false);
                jumpTo(link.id);
              }}
              className="text-base font-medium py-2 px-4 rounded-md text-white/80 hover:bg-white/5 hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-white/10 my-2" />
          <Button asChild className="w-full bg-accent text-accent-foreground font-semibold rounded-none">
            <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)}>Build a Gift Card</Link>
          </Button>
        </div>
      )}

      {/* Cart drops down from the menu bar */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCartOpen(false)} aria-hidden />
          <div className="absolute right-4 md:right-6 top-full mt-2 z-50 w-[min(26rem,calc(100vw-2rem))] animate-in slide-in-from-top-4 fade-in">
            <div className="max-h-[75vh] overflow-y-auto shadow-2xl">
              <CartPanel
                onCheckout={() => {
                  setCartOpen(false);
                  setCheckingOut(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {checkingOut && <CheckoutDialog onClose={() => setCheckingOut(false)} />}
    </header>
  );
}
