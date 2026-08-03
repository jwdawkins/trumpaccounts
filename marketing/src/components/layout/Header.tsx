import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/shop", label: "Shop Cards" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/about-trump-accounts", label: "Trump Accounts" },
    { href: "/faq", label: "FAQ" },
  ];

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
                className={`text-sm font-medium transition-colors hover:text-accent ${
                  location === link.href ? "text-accent" : "text-white/80"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="text-sm font-medium text-white/80 hover:text-accent transition-colors">
              Contact
            </Link>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-none px-6 font-semibold">
              <Link href="/#configurator">Build a Gift Card</Link>
            </Button>
          </div>
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-white hover:text-accent transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-primary border-b border-white/10 shadow-lg py-4 px-4 flex flex-col gap-4 animate-in slide-in-from-top-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`text-base font-medium py-2 px-4 rounded-md ${
                location === link.href
                  ? "bg-white/10 text-accent"
                  : "text-white/80 hover:bg-white/5 hover:text-accent"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-white/10 my-2" />
          <Link
            href="/contact"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-base font-medium py-2 px-4 text-white/80 hover:bg-white/5 hover:text-accent rounded-md"
          >
            Contact
          </Link>
          <Button asChild className="mt-2 w-full bg-accent text-accent-foreground font-semibold rounded-none">
            <Link href="/#configurator" onClick={() => setIsMobileMenuOpen(false)}>Build a Gift Card</Link>
          </Button>
        </div>
      )}
    </header>
  );
}