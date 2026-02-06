import { Suspense } from "react";
import { HomeClient } from "@/components/layout/HomeClient";

type HomePageProps = {
  searchParams?: Promise<{
    case?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const caseParam = resolvedParams.case ?? null;
  return (
    <Suspense fallback={null}>
      <HomeClient initialCase={caseParam} />
    </Suspense>
  );
}
