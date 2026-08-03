import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import HowItWorks from "@/pages/HowItWorks";
import AboutTrumpAccounts from "@/pages/AboutTrumpAccounts";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

/**
 * wouter doesn't act on URL hashes, so `#configurator`-style links (e.g. the
 * "Build a Gift Card" CTA) never scrolled. This scrolls to the hash target on
 * route change and on hash change, and resets to top on a plain navigation.
 */
function ScrollToHash() {
  const [location] = useLocation();
  useEffect(() => {
    const scrollToHash = () => {
      const { hash } = window.location;
      if (hash.length > 1) {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      window.scrollTo({ top: 0 });
    };
    // Defer so the target for the new route is mounted before we scroll.
    const timer = window.setTimeout(scrollToHash, 60);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/about-trump-accounts" component={AboutTrumpAccounts} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ScrollToHash />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
