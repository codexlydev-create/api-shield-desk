import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Bot as BotIcon, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { sessionStore, botsStore, getBotStatus, type Bot } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BotFormDialog } from "@/components/bot-form-dialog";
import { BotsTable } from "@/components/bots-table";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !sessionStore.get()) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [search, setSearch] = useState("");
  const [bots, setBots] = useState<Bot[]>([]);
  const [_tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for the auth context to finish hydrating before deciding anything.
    // On a hard refresh, `user` is briefly null while /me is in-flight — we
    // must NOT redirect to /login during that window or the dashboard will
    // appear to "log out" on every refresh.
    if (authLoading) return;
    if (!user) {
      // Only redirect if there is also no token. If a token exists but the
      // /me call failed transiently (e.g. cold-start 503), keep the user here
      // and let auth-context retry rather than bouncing them to login.
      if (!sessionStore.get()) navigate({ to: "/login" });
      return;
    }
    const refresh = () => setBots(botsStore.byOwner(user.id));
    refresh();
    // Brief skeleton on first mount
    const loadTimer = setTimeout(() => setLoading(false), 500);
    const handler = () => refresh();
    window.addEventListener("bvm:change", handler);
    window.addEventListener("storage", handler);
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      window.removeEventListener("bvm:change", handler);
      window.removeEventListener("storage", handler);
      clearInterval(interval);
      clearTimeout(loadTimer);
    };
  }, [user, authLoading, navigate]);

  const stats = useMemo(() => {
    let active = 0, expired = 0, blocked = 0;
    bots.forEach((b) => {
      const s = getBotStatus(b);
      if (s === "active") active++;
      else if (s === "expired") expired++;
      else blocked++;
    });
    return { total: bots.length, active, expired, blocked };
  }, [bots]);

  // While auth is hydrating after a hard refresh, render skeletons instead
  // of nothing so the page doesn't flicker to login.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="text-sm text-muted-foreground">Welcome back, {user.name.split(" ")[0]} 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Your <span className="text-gradient-sunset">APPLICATION</span> dashboard
            </h1>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-gradient-sunset text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Plus className="mr-1 h-5 w-5" /> Create New APPLICATION Validity
          </Button>
        </motion.div>

        {loading && (
          <div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
            <div className="mt-6 space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        )}
        {!loading && (
          <div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total", value: stats.total, icon: BotIcon, gradient: "bg-gradient-sunset" },
                { label: "Active", value: stats.active, icon: ShieldCheck, gradient: "bg-success" },
                { label: "Expired", value: stats.expired, icon: Clock, gradient: "bg-destructive" },
                { label: "Blocked", value: stats.blocked, icon: ShieldAlert, gradient: "bg-warning" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${s.gradient} text-primary-foreground`}>
                      <s.icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{s.value}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-6">
              <BotsTable
                ownerId={user.id}
                search={search}
                onSearch={setSearch}
                onEdit={(b) => {
                  setEditing(b);
                  setOpen(true);
                }}
              />
            </div>
          </div>
        )}
      </main>

      <BotFormDialog open={open} onOpenChange={setOpen} ownerId={user.id} bot={editing} />
    </div>
  );
}
