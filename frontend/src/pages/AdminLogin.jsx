import { useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { Logo } from "@/components/TopNav";
import { useAuth } from "@/context/AuthContext";
import { errText } from "@/lib/api";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = (u) => (next && next.startsWith("/") ? next : u.role === "admin" ? "/admin" : "/tools");
  if (user) return <Navigate to={dest(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const u = await login(email, password); navigate(dest(u)); } catch (ex) { setErr(errText(ex)); } finally { setBusy(false); }
  };

  return (
    <PageShell testid="admin-login-page">
      <div className="max-w-md mx-auto mt-6 rounded-[28px] bg-white/85 backdrop-blur-xl border border-[#f1d6cc] p-10 shadow-[0_30px_80px_-30px_rgba(160,30,20,0.4)]">
        <Logo className="h-14" />
        <h1 className="font-display text-4xl font-extrabold tracking-tight mt-6">Sign in</h1>
        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="admin-login-form">
          <div className="space-y-2"><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-white" data-testid="admin-login-email-input" /></div>
          <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl bg-white" data-testid="admin-login-password-input" /></div>
          {err && <p className="text-sm text-[#e0141b]" data-testid="admin-login-error">{err}</p>}
          <button disabled={busy} className="w-full h-12 rounded-full bg-[#e0141b] text-white font-bold hover:brightness-110 active:scale-[0.98] transition-[filter,transform] disabled:opacity-60 inline-flex items-center justify-center gap-2" data-testid="admin-login-submit-button">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
          </button>
        </form>
      </div>
    </PageShell>
  );
}
