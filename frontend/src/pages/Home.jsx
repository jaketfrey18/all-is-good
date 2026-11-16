import { TopNav } from "@/components/TopNav";
import { HeroScene } from "@/components/hero/HeroScene";
import { SearchBar } from "@/components/SearchBar";
import { Coverflow } from "@/components/Coverflow";
import { useProjects } from "@/lib/hooks";

export default function Home() {
  const { data: projects = [], isLoading } = useProjects();
  return (
    <div className="relative min-h-screen overflow-hidden" data-testid="home-page">
      <HeroScene />
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopNav active="worlds" />
        <h1 className="sr-only">All is good — the Cooked World</h1>
        <section className="rise w-full max-w-[1080px] mx-auto px-4 mt-[9vh] sm:mt-[14vh]">
          <SearchBar />
        </section>
        <section className="rise flex-1 flex flex-col justify-end pb-8 mt-6" style={{ animationDelay: "0.2s" }}>
          {isLoading ? <div className="h-[420px]" data-testid="carousel-loading" /> : <Coverflow projects={projects} />}
        </section>
      </div>
    </div>
  );
}
