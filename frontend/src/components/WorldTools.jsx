import { WorldLists } from "@/components/WorldLists";

export const WorldTools = ({ slug }) => (
  <section data-testid="world-tools">
    <WorldLists world={slug} />
  </section>
);
