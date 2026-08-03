import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ContactForm } from "@/components/ContactForm";
import { Mail, MapPin, Phone } from "lucide-react";

export default function Contact() {
  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Header />
      
      <main className="flex-1">
        <div className="bg-primary text-white py-16 md:py-24 border-y border-accent/30">
          <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 text-white">Get in Touch</h1>
            <p className="text-xl text-[#F5F0E8] font-light leading-relaxed">
              We're here to answer any questions about Trump Account Gift Cards, bulk orders, or account setup.
            </p>
          </div>
        </div>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 md:px-6 max-w-[1200px]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
              
              {/* Contact Info */}
              <div className="lg:col-span-1 space-y-10">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-primary mb-6">Contact Information</h2>
                  <p className="text-foreground/80 text-lg leading-relaxed">
                    Our customer support team is available Monday through Friday, 9:00 AM to 5:00 PM EST.
                  </p>
                </div>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary font-serif text-xl mb-1">Email</h3>
                      <p className="text-foreground/80">support@trumpaccountgiftcards.com</p>
                      <p className="text-sm text-foreground/50 mt-1">We aim to respond within 24 hours.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary font-serif text-xl mb-1">Phone</h3>
                      <p className="text-foreground/80">1-800-555-0198</p>
                      <p className="text-sm text-foreground/50 mt-1">Mon-Fri, 9am - 5pm EST</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary font-serif text-xl mb-1">Corporate Office</h3>
                      <p className="text-foreground/80 leading-relaxed">
                        WD Fintech, LLC<br />
                        123 Financial District Blvd.<br />
                        Suite 400<br />
                        New York, NY 10005
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-8 border border-border shadow-sm mt-12">
                  <h3 className="font-serif font-bold text-primary text-xl mb-3">Corporate Gifting</h3>
                  <p className="text-foreground/80 mb-6 leading-relaxed">
                    Interested in purchasing Trump Account Gift Cards for your employees or clients?
                  </p>
                  <a href="mailto:corporate@trumpaccountgiftcards.com" className="font-bold text-accent hover:text-primary transition-colors uppercase tracking-widest text-sm font-sans">
                    Contact our corporate team &rarr;
                  </a>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <ContactForm />
              </div>
              
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}