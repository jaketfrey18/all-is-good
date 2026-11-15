import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { DropboxCard } from "@/components/admin/DropboxCard";
import { ProjectsManager } from "@/components/admin/ProjectsManager";
import { useAuth } from "@/context/AuthContext";

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const s = params.get("dropbox");
    if (s === "connected") toast.success("Dropbox connected. All is good.");
    if (s === "error") toast.error(`Dropbox connection failed: ${params.get("reason") || "please try again"}.`, { duration: 15000 });
    if (s) setParams({}, { replace: true });
  }, [params, setParams]);

  return (
    <PageShell eyebrow="Admin" title="The kitchen." testid="admin-panel-page">
      <div className="flex items-center justify-between mt-4">
        <p className="font-mono text-sm text-[#7a5f56]" data-testid="admin-user-email">{user?.email}</p>
        <button onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#e8262f] transition-colors" data-testid="admin-logout-button"><LogOut className="w-4 h-4" /> Sign out</button>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-8 mt-10 items-start">
        <DropboxCard />
        <ProjectsManager />
      </div>
    </PageShell>
  );
}
