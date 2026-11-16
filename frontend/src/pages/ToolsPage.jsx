import { PageShell } from "@/components/PageShell";
import { WorldLists } from "@/components/WorldLists";
import { useProjects } from "@/lib/hooks";

export default function ToolsPage() {
  const { data: worlds = [] } = useProjects();
  return (
    <PageShell dark active="tools" testid="tools-page">
      <WorldLists worlds={worlds} showWorld />
    </PageShell>
  );
}
