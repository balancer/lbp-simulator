import { Suspense } from "react";
import { HomeClient } from "@/components/layout/HomeClient";

type HomePageProps = {
  searchParams?: {
    case?: string;
  };
};

export default function Home({ searchParams }: HomePageProps) {
  const caseParam = searchParams?.case ?? null;
  return (
    <Suspense fallback={null}>
      <HomeClient initialCase={caseParam} />
    </Suspense>
  );
}
