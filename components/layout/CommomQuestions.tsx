"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const QUESTIONS = [
  {
    question: "What is an LBP?",
    answer:
      "A Liquidity Bootstrapping Pool is a mechanism for fair price discovery where token weights shift over time to balance demand and price.",
  },
  {
    question: "How does the simulator help?",
    answer:
      "It lets you model weights, duration, and demand assumptions so you can see how price and liquidity evolve before launch.",
  },
  {
    question: "Can LBPs be used for buy-backs or divestment?",
    answer:
      "Yes. LBPs are flexible enough for structured buy-backs or gradual divestment with transparent parameters.",
  },
  {
    question: "Do I need on-chain liquidity to start?",
    answer:
      "You’ll need initial liquidity, but the pool design helps distribute it over time and keeps discovery transparent.",
  },
];

export function CommomQuestions() {
  return (
    <section className="w-full container mx-auto max-w-5xl px-4 md:px-6 mt-12 md:mt-16">
      <div className="flex flex-col gap-6 items-center">
        <h3 className="text-xl md:text-3xl font-semibold text-foreground opacity-50">
          Common Questions
        </h3>
        <Accordion type="single" collapsible className="w-full">
          {QUESTIONS.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
