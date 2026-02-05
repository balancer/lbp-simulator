import { HomeClient } from "@/components/layout/HomeClient";

type HomePageProps = {
  searchParams?: {
    case?: string;
  };
};

export default function Home({ searchParams }: HomePageProps) {
  const caseParam = searchParams?.case ?? null;
  return <HomeClient initialCase={caseParam} />;
}
