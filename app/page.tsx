import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { Simulator } from "@/components/home/simulator/Simulator";
import { DetailsSection } from "@/components/home/DetailsSection";
import { useSidebar } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans z-0">
      <Header />
      <main className="flex-1 w-full px-20">
        <Hero />
        <Simulator/>
        <DetailsSection />
      </main>
      <Footer />
    </div>
  );
}
