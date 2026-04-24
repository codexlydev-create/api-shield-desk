import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { botsStore, formatDateTime, getBotStatus, type Bot } from "@/lib/storage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/api/bot/$id")({
  component: BotApiView,
});

function computeRemaining(expiryIso: string) {
  let ms = new Date(expiryIso).getTime() - Date.now();
  const expired = ms <= 0;
  ms = Math.abs(ms);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { expired, days, hours, minutes, seconds };
}

function BotApiView() {
  const { id } = Route.useParams();
  const [bot, setBot] = useState<Bot | undefined | null>(undefined);
  const [, setNow] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setBot(botsStore.byId(id) ?? null);
    refresh();
    const handler = () => refresh();
    window.addEventListener("bvm:change", handler);
    window.addEventListener("storage", handler);
    // Tick every second so "Remaining time" stays live
    const t = setInterval(() => {
      refresh();
      setNow((n) => n + 1);
    }, 1000);
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
      : (() => {
          const r = computeRemaining(bot.expiryDate);
          return {
            id: bot.id,
            expiry_date: formatDateTime(bot.expiryDate),
            status: getBotStatus(bot),
            remaining_time: r.expired
              ? `Expired ${r.days}d ${r.hours}h ${r.minutes}m ${r.seconds}s ago`
              : `${r.days}d ${r.hours}h ${r.minutes}m ${r.seconds}s`,
            remaining: {
              days: r.expired ? -r.days : r.days,
              hours: r.expired ? -r.hours : r.hours,
              minutes: r.expired ? -r.minutes : r.minutes,
              seconds: r.expired ? -r.seconds : r.seconds,
            },
          };
        })();

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

        {bot && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining time</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Expires <span className="font-medium text-foreground">{formatDateTime(bot.expiryDate)}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
              {(() => {
                const r = computeRemaining(bot.expiryDate);
                const cells = [
                  { label: "Days", value: r.days },
                  { label: "Hours", value: r.hours },
                  { label: "Minutes", value: r.minutes },
                  { label: "Seconds", value: r.seconds },
                ];
                return cells.map((c) => (
                  <div
                    key={c.label}
                    className={`rounded-xl border border-border/60 ${r.expired ? "bg-destructive/5" : "bg-gradient-sunset/5"} p-3 text-center`}
                  >
                    <div
                      className={`font-mono text-2xl font-bold tabular-nums sm:text-3xl ${r.expired ? "text-destructive" : "text-gradient-sunset"}`}
                    >
                      {String(c.value).padStart(2, "0")}
                    </div>
                    <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </div>
                  </div>
                ));
              })()}
            </div>
            {(() => {
              const r = computeRemaining(bot.expiryDate);
              return (
                <p className={`mt-3 text-center text-sm font-medium ${r.expired ? "text-destructive" : "text-foreground"}`}>
                  {r.expired ? "Expired " : ""}
                  {r.days}d {r.hours}h {r.minutes}m {r.seconds}s {r.expired ? "ago" : "remaining"}
                </p>
              );
            })()}
          </div>
        )}

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
            <code>
              <HighlightedJson json={json} liveKeys={["remaining_time", "remaining", "days", "hours", "minutes", "seconds", "status"]} />
            </code>
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

function HighlightedJson({ json, liveKeys }: { json: string; liveKeys: string[] }) {
  // Tokenize the JSON line by line and colorize keys, strings, numbers, booleans.
  const liveSet = new Set(liveKeys);
  const lines = json.split("\n");

  // Track the current key on each value line so we can highlight live values.
  return (
    <>
      {lines.map((line, i) => {
        const keyMatch = line.match(/^(\s*)"([^"]+)":\s*(.*)$/);
        if (keyMatch) {
          const [, indent, key, rest] = keyMatch;
          const isLive = liveSet.has(key);
          return (
            <div key={i} className={isLive ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}>
              {indent}
              <span className="text-primary">"{key}"</span>
              <span className="text-muted-foreground">: </span>
              {renderValue(rest, isLive)}
            </div>
          );
        }
        // structural lines: { } , [ ]
        return (
          <div key={i} className="text-muted-foreground">
            {line}
          </div>
        );
      })}
    </>
  );
}

function renderValue(raw: string, isLive: boolean) {
  // Strip trailing comma for matching, then re-append.
  const trailingComma = raw.endsWith(",");
  const value = trailingComma ? raw.slice(0, -1) : raw;
  const comma = trailingComma ? <span className="text-muted-foreground">,</span> : null;

  const liveClass = isLive ? "rounded bg-gradient-sunset/15 px-1 font-semibold text-gradient-sunset" : "";

  if (value.startsWith('"') && value.endsWith('"')) {
    return (
      <>
        <span className={`text-success ${liveClass}`}>{value}</span>
        {comma}
      </>
    );
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return (
      <>
        <span className={`text-warning-foreground ${liveClass}`}>{value}</span>
        {comma}
      </>
    );
  }
  if (value === "true" || value === "false" || value === "null") {
    return (
      <>
        <span className="text-destructive">{value}</span>
        {comma}
      </>
    );
  }
  // Opening brace of nested object
  return (
    <>
      <span className="text-muted-foreground">{value}</span>
      {comma}
    </>
  );
}
