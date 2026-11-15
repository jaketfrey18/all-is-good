import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { FortuneCookie } from "@/components/FortuneCookie";
import { useAuth } from "@/context/AuthContext";
import { errText } from "@/lib/api";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(email, password); navigate("/admin"); } catch (ex) { setErr(errText(ex)); } finally { setBusy(false); }
  };

  return (
    <PageShell testid="admin-login-page">
      <div className="max-w-md mx-auto mt-6 rounded-[28px] bg-white/85 backdrop-blur-xl border border-[#ecd3c4] p-10 shadow-[0_30px_80px_-30px_rgba(160,50,20,0.4)]">
        <FortuneCookie className="w-24 cookie-float" />
        <h1 className="font-display text-4xl font-extrabold tracking-tight mt-4">Kitchen access</h1>
        <p className="text-[#7a5f56] mt-1">Admins only. All is good.</p>
        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="admin-login-form">
          <div className="space-y-2"><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-white" data-testid="admin-login-email-input" /></div>
          <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl bg-white" data-testid="admin-login-password-input" /></div>
          {err && <p className="text-sm text-[#e8262f]" data-testid="admin-login-error">{err}</p>}
          <button disabled={busy} className="w-full h-12 rounded-full bg-[#e8262f] text-white font-bold hover:brightness-110 active:scale-[0.98] transition-[filter,transform] disabled:opacity-60 inline-flex items-center justify-center gap-2" data-testid="admin-login-submit-button">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
          </button>
        </form>
      </div>
    </PageShell>
  );
}
