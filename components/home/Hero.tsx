import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="w-full container mx-auto max-w-5xl flex flex-col items-center justify-center py-20 md:py-32 px-4 md:px-6 text-center">
      <h1 className="text-4xl md:text-6xl lg:text-7xl text-foreground tracking-tight mb-6">
        Launch the next disruptive token
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
        Simulate a token sale by LBP pool to understand how Balancer can rocket your token launch to success.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          className="bg-[#E6C8A3] hover:bg-[#E6C8A3]/80 text-white rounded-full px-8 text-base"
        >
          Get started
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="rounded-full px-8 text-base hover:bg-[#E6C8A3]/50"
        >
          Learn more
        </Button>
      </div>
    </section>
  );
}
