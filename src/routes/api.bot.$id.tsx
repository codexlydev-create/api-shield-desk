import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { publicApi, type PublicApplicationResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/api/bot/$id")({
  component: BotApiView,
});

function BotApiView() {
  const { id } = Route.useParams();
  const [payload, setPayload] = useState<PublicApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await publicApi.getApplication(id);
        if (alive) setPayload(res);
      } catch (err) {
        if (alive) {
          const status = (err as { status?: number })?.status;
          const message = (err as Error)?.message || "Not found";
          setPayload({
            id,
            expiry_date: "",
            status: "expired",
            remaining_time: "",
            remaining: { days: 0, hours: 0, minutes: 0, seconds: 0 },
            error: status === 404 ? "Not found" : message,
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  const notFound = !!payload?.error;

  const displayPayload = payload
    ? notFound
      ? { error: payload.error, id: payload.id }
      : {
          id: payload.id,
          expiry_date: payload.expiry_date,
          status: payload.status,
          remaining_time: payload.remaining_time,
          remaining: payload.remaining,
        }
    : null;

  const json = displayPayload ? JSON.stringify(displayPayload, null, 2) : "";

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
          {payload && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                notFound
                  ? "bg-destructive/15 text-destructive"
                  : payload.status === "active"
                    ? "bg-success/15 text-success"
                    : payload.status === "expired"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/20 text-warning-foreground"
              }`}
            >
              {notFound ? "404" : payload.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="text-gradient-sunset">APPLICATION</span> validity endpoint
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">GET /api/public/applications/{id}</code>
          </p>
        </div>

        {loading && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}

        {!loading && payload && !notFound && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining time</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Expires <span className="font-medium text-foreground">{payload.expiry_date}</span>
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
              {(() => {
                const expired = payload.status === "expired";
                const r = payload.remaining;
                const cells = [
                  { label: "Days", value: Math.abs(r.days) },
                  { label: "Hours", value: Math.abs(r.hours) },
                  { label: "Minutes", value: Math.abs(r.minutes) },
                  { label: "Seconds", value: Math.abs(r.seconds) },
                ];
                return cells.map((c) => (
                  <div
                    key={c.label}
                    className={`rounded-xl border border-border/60 ${expired ? "bg-destructive/5" : "bg-gradient-sunset/5"} p-3 text-center`}
                  >
                    <div
                      className={`font-mono text-2xl font-bold tabular-nums sm:text-3xl ${expired ? "text-destructive" : "text-gradient-sunset"}`}
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
            <p className="mt-3 text-center text-sm font-medium">
              {payload.remaining_time}
            </p>
          </div>
        )}

        {!loading && displayPayload && (
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
        )}

        {!loading && !notFound && (
          <p className="mt-4 text-xs text-muted-foreground">
            Public endpoint — live response from the backend. Updates every second.
            {payload && payload.status === "active" && (
              <span className="ml-1 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> syncing
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function HighlightedJson({ json, liveKeys }: { json: string; liveKeys: string[] }) {
  const liveSet = new Set(liveKeys);
  const lines = json.split("\n");
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
  return (
    <>
      <span className="text-muted-foreground">{value}</span>
      {comma}
    </>
  );
}
