import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Home from "@/pages/Home";
import MediaPage from "@/pages/MediaPage";
import ToolsPage from "@/pages/ToolsPage";
import CanvasPage from "@/pages/CanvasPage";
import LyricPage from "@/pages/LyricPage";
import ClipStudio from "@/pages/ClipStudio";
import Workspace from "@/pages/Workspace";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";

const Loading = () => <div className="min-h-screen grid place-items-center font-mono text-sm bg-[#141011] text-white/60" data-testid="auth-loading">Checking session…</div>;

function RequireUser({ children, admin = false }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && user.role !== "admin") return <Navigate to="/tools" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/search" element={<MediaPage />} />
          <Route path="/p/:slug" element={<Workspace />} />
          <Route path="/tools" element={<RequireUser><ToolsPage /></RequireUser>} />
          <Route path="/canvas/:id" element={<RequireUser><CanvasPage /></RequireUser>} />
          <Route path="/lyrics/:id" element={<RequireUser><LyricPage /></RequireUser>} />
          <Route path="/studio/:id" element={<RequireUser><ClipStudio /></RequireUser>} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireUser admin><AdminPanel /></RequireUser>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  );
}

export default App;
