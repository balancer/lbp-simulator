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
    question: "Why should I use a LBP?",
    answer:
      "LBPs give flexible, programmable price discovery with a simple setup. Just configure a few key parameters - curve, duration, weights - and Balancer handles the rest. Everything runs onchain and permissionless, so you get full transparency and verifiability without relying on centralized intermediaries or trusted third parties.",
  },
  {
    question: "Do I need on-chain liquidity to start?",
    answer:
    "The seedless feature enables teams to launch an LBP using virtual liquidity, eliminating the need for any upfront capital commitment.",
  },
  {
    question: "Can I create a Fixed Price LBP?",
    answer:
      "Yes. LBPs offer the flexibility to implement structured fixed price strategies over time, enabling teams to launch tokens in a more efficient and controlled manner.",
  },
  {
    question: "I wanted to deploy a LBP on a EVM with no support. How can I proceed?",
    answer:
      "Contact our product and support team to learn more about new integrations and other issues.",
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
