import { createContext, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "@/lib/api";
import { colorFor } from "@/lib/hooks";

const AuthCtx = createContext(null);
const withColor = (u) => ({ ...u, name: u.name || u.email.split("@")[0], color: colorFor(u.id) });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(withColor(r.data))).catch(() => setUser(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    const u = withColor(data.user);
    setUser(u);
    return u;
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
