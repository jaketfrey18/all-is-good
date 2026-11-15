import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Home from "@/pages/Home";
import ProjectsPage from "@/pages/ProjectsPage";
import ArchivePage from "@/pages/ArchivePage";
import StudioPage from "@/pages/StudioPage";
import ContactPage from "@/pages/ContactPage";
import SearchPage from "@/pages/SearchPage";
import Workspace from "@/pages/Workspace";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";

function AdminGate() {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen grid place-items-center font-mono text-sm" data-testid="auth-loading">Checking session…</div>;
  return user ? <AdminPanel /> : <Navigate to="/admin/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/p/:slug" element={<Workspace />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminGate />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  );
}

export default App;
