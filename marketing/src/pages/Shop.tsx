import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CardConfigurator } from "@/components/CardConfigurator";

export default function Shop() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />

      <main className="flex-1 bg-background">
        <section className="container mx-auto px-4 md:px-6 py-8 md:py-10 max-w-[1320px]">
          <CardConfigurator />
        </section>
      </main>

      <Footer />
    </div>
  );
}
