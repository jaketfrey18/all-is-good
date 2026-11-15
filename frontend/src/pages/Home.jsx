import { useState } from "react";
import { Nav } from "@/components/Nav";
import { HeroScene } from "@/components/hero/HeroScene";
import { SearchBar } from "@/components/SearchBar";
import { CategoryRow } from "@/components/CategoryRow";
import { Coverflow } from "@/components/Coverflow";
import { useProjects } from "@/components/NotificationsBell";

export default function Home() {
  const [cat, setCat] = useState(null);
  const { data: projects = [], isLoading } = useProjects(cat);

  return (
    <div className="relative min-h-screen overflow-hidden" data-testid="home-page">
      <HeroScene />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Nav />
        <h1 className="sr-only">All is good — the Cooked World</h1>
        <section className="rise w-full max-w-[1100px] mx-auto px-4 mt-[8vh] sm:mt-[13vh]">
          <SearchBar />
        </section>
        <section className="rise mt-8 sm:mt-10 px-4" style={{ animationDelay: "0.15s" }}>
          <CategoryRow active={cat} onSelect={setCat} />
        </section>
        <section className="rise flex-1 flex flex-col justify-center mt-4 pb-6" style={{ animationDelay: "0.3s" }}>
          {isLoading ? (
            <div className="h-[400px] grid place-items-center font-mono text-sm text-[#5b4741]" data-testid="carousel-loading">cooking…</div>
          ) : projects.length ? (
            <Coverflow projects={projects} />
          ) : (
            <div className="h-[400px] grid place-items-center" data-testid="carousel-empty">
              <p className="font-display text-2xl font-bold text-[#3a2a26]">Nothing in {cat} yet. All is still good.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
