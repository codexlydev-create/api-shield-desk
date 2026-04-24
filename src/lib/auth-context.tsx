import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { hashPassword, sessionStore, usersStore, type User } from "./storage";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(() => {
    const s = sessionStore.get();
    setUser(s ? usersStore.byId(s.userId) ?? null : null);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    window.addEventListener("bvm:change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("bvm:change", handler);
    };
  }, [refresh]);

  const login = useCallback((email: string, password: string) => {
    const u = usersStore.byEmail(email);
    if (!u) return { ok: false, error: "No account found with that email." };
    if (u.passwordHash !== hashPassword(password)) return { ok: false, error: "Incorrect password." };
    if (!u.emailVerified) return { ok: false, error: "Please verify your email first." };
    sessionStore.set(u.id);
    setUser(u);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    sessionStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, logout, refresh }),
    [user, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
