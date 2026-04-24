import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { botsStore, formatDateTime, getBotStatus, type Bot } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/api/bot/$id")({
  component: BotApiView,
});

function BotApiView() {
  const { id } = Route.useParams();
  const [bot, setBot] = useState<Bot | undefined | null>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setBot(botsStore.byId(id) ?? null);
    refresh();
    const handler = () => refresh();
    window.addEventListener("bvm:change", handler);
    window.addEventListener("storage", handler);
    const t = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("bvm:change", handler);
      window.removeEventListener("storage", handler);
      clearInterval(t);
    };
  }, [id]);

  if (bot === undefined) return null;

  const payload =
    bot === null
      ? { error: "Not found", id }
      : {
          id: bot.id,
          expiry_date: formatDateTime(bot.expiryDate),
          status: getBotStatus(bot),
        };

  const json = JSON.stringify(payload, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Response copied");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-gradient-mesh opacity-60" />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Back to dashboard
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              bot === null
                ? "bg-destructive/15 text-destructive"
                : getBotStatus(bot) === "active"
                  ? "bg-success/15 text-success"
                  : getBotStatus(bot) === "expired"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-warning/20 text-warning-foreground"
            }`}
          >
            {bot === null ? "404" : getBotStatus(bot).toUpperCase()}
          </span>
        </div>

        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="text-gradient-sunset">BOT</span> validity endpoint
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">GET /api/bot/{id}</code>
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elegant">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-xs font-medium text-muted-foreground">application/json</span>
            </div>
            <Button size="sm" variant="ghost" onClick={copy}>
              {copied ? <Check className="mr-1 h-4 w-4 text-success" /> : <Copy className="mr-1 h-4 w-4" />}
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto bg-background p-5 font-mono text-sm leading-relaxed">
            <code>{json}</code>
          </pre>
        </div>

        {bot && (
          <p className="mt-4 text-xs text-muted-foreground">
            Status updates live based on expiry date and block toggle. This is a demo endpoint backed by your browser's
            local storage.
          </p>
        )}
      </div>
    </div>
  );
}
