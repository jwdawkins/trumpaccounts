import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is a Trump Account Gift Card?",
    answer: "A gift card where you choose what percentage goes to spending and what percentage goes into a child's Trump Account (Section 530A IRA)."
  },
  {
    question: "How does the split work?",
    answer: "When you buy, you pick a split — 10%, 20%, 25%, 50%, 100%, or a custom amount — that goes to the Trump Account. The rest becomes a gift card in the brand you choose (Visa, Amazon, Starbucks, or Walmart) for them to spend."
  },
  {
    question: "What denominations are available?",
    answer: "Any amount — choose a preset ($25 to $500) or enter a custom amount at checkout. Keep in mind Trump Account contributions are capped at $5,000 per child per year, so the invested portion counts toward that limit."
  },
  {
    question: "Who can buy one?",
    answer: "Anyone. You don't need to be related to the child."
  },
  {
    question: "What if the recipient doesn't have a Trump Account?",
    answer: "We guide them through setting one up at form.trumpaccounts.gov."
  },
  {
    question: "Where are Trump Accounts held?",
    answer: "Currently at Bank of New York Mellon and Robinhood."
  },
  {
    question: "What gift cards can I choose from?",
    answer: "The spendable portion is a real gift card in the brand you pick at checkout — Visa, Amazon, Starbucks, or Walmart."
  },
  {
    question: "Is my contribution tax-deductible?",
    answer: "No. Contributions are not tax-deductible, but funds grow tax-advantaged."
  },
  {
    question: "What is the annual contribution limit?",
    answer: "$5,000 per child per year from individuals and employers combined."
  },
  {
    question: "Is this affiliated with the U.S. government?",
    answer: "No. Trump Account Gift Cards is a private product by WD Fintech, LLC."
  },
  {
    question: "Can I buy in bulk?",
    answer: "Yes! Contact us for bulk and corporate gifting options."
  }
];

export function FAQAccordion() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <Accordion type="single" collapsible className="w-full space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem 
            key={index} 
            value={`item-${index}`}
            className="bg-white border border-border px-6 data-[state=open]:border-primary transition-all rounded-none"
          >
            <AccordionTrigger className="text-left font-serif font-bold text-xl py-6 hover:no-underline text-primary">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 leading-relaxed pb-6 text-base font-sans">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}