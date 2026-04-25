import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, Copy, Edit2, ExternalLink, Filter, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { botsStore, formatDateTime, getBotStatus, type Bot, type BotStatus } from "@/lib/storage";

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              toast.success(`${label} copied`);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              toast.error("Copy failed");
            }
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>Copy {label}</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: BotStatus }) {
  if (status === "active")
    return (
      <Badge className="border-0 bg-success/15 text-success hover:bg-success/20">
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        Active
      </Badge>
    );
  if (status === "expired")
    return <Badge className="border-0 bg-destructive/15 text-destructive hover:bg-destructive/20">Expired</Badge>;
  return <Badge className="border-0 bg-warning/20 text-warning-foreground hover:bg-warning/30">Blocked</Badge>;
}

function truncateChars(text: string, n = 15): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function getRemaining(expiryIso: string) {
  let ms = new Date(expiryIso).getTime() - Date.now();
  const expired = ms <= 0;
  ms = Math.abs(ms);
  return {
    expired,
    totalMs: ms,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

function Countdown({ expiryIso }: { expiryIso: string }) {
  const r = getRemaining(expiryIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (r.expired) {
    return (
      <span className="font-mono text-xs tabular-nums text-destructive">
        −{r.days}d {pad(r.hours)}:{pad(r.minutes)}:{pad(r.seconds)}
      </span>
    );
  }
  const tone =
    r.days === 0 && r.hours < 24
      ? "text-destructive"
      : r.days <= 1
        ? "text-warning-foreground"
        : r.days <= 7
          ? "text-foreground"
          : "text-foreground";
  return (
    <span className={`font-mono text-xs tabular-nums ${tone}`}>
      {r.days > 0 && <span className="font-semibold">{r.days}d </span>}
      {pad(r.hours)}:{pad(r.minutes)}:{pad(r.seconds)}
    </span>
  );
}

type RemainingFilter = "all" | "expired" | "today" | "1d" | "3d" | "5d" | "7d" | "30d" | "30d+";
type StatusFilter = "all" | BotStatus;
type SortOrder = "none" | "remaining-desc" | "remaining-asc";

export function BotsTable({
  ownerId,
  search,
  onSearch,
  onEdit,
}: {
  ownerId: string;
  search: string;
  onSearch: (v: string) => void;
  onEdit: (b: Bot) => void;
}) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [_tick, setTick] = useState(0);
  const [toDelete, setToDelete] = useState<Bot | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [remainingFilter, setRemainingFilter] = useState<RemainingFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("none");

  useEffect(() => {
    const refresh = () => setBots(botsStore.byOwner(ownerId));
    refresh();
    const handler = () => refresh();
    window.addEventListener("bvm:change", handler);
    window.addEventListener("storage", handler);
    // tick every second so countdown stays live
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      window.removeEventListener("bvm:change", handler);
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, [ownerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const DAY = 86_400_000;
    const list = bots.filter((b) => {
      if (q && !(b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q))) return false;

      const status = getBotStatus(b);
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (remainingFilter !== "all") {
        const ms = new Date(b.expiryDate).getTime() - Date.now();
        switch (remainingFilter) {
          case "expired":
            if (ms > 0) return false;
            break;
          case "today":
            if (ms <= 0 || ms > DAY) return false;
            break;
          case "1d":
            if (ms <= 0 || ms > DAY) return false;
            break;
          case "3d":
            if (ms <= 0 || ms > 3 * DAY) return false;
            break;
          case "5d":
            if (ms <= 0 || ms > 5 * DAY) return false;
            break;
          case "7d":
            if (ms <= 0 || ms > 7 * DAY) return false;
            break;
          case "30d":
            if (ms <= 0 || ms > 30 * DAY) return false;
            break;
          case "30d+":
            if (ms <= 30 * DAY) return false;
            break;
        }
      }
      return true;
    });

    if (sortOrder !== "none") {
      list.sort((a, b) => {
        const ta = new Date(a.expiryDate).getTime();
        const tb = new Date(b.expiryDate).getTime();
        return sortOrder === "remaining-desc" ? tb - ta : ta - tb;
      });
    }
    return list;
  }, [bots, search, statusFilter, remainingFilter, sortOrder]);

  const API_BASE =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
  // Public, unauthenticated raw JSON response — served by the backend API.
  const apiUrl = (b: Bot) => `${API_BASE}/api/public/applications/${b.id}`;
  // Frontend preview page — formatted, live JSON preview UI.
  const previewUrl = (b: Bot) => `${APP_ORIGIN}/api/public/applications/${b.id}/preview`;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-2xl border border-border/60 bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your APPLICATIONs</h2>
              <p className="text-sm text-muted-foreground">
                {filtered.length} of {bots.length} {bots.length === 1 ? "APPLICATION" : "APPLICATIONs"}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search by ID or name…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filters:
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={remainingFilter}
              onValueChange={(v) => setRemainingFilter(v as RemainingFilter)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[200px]">
                <SelectValue placeholder="All remaining time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any remaining time</SelectItem>
                <SelectItem value="expired">Expired only</SelectItem>
                <SelectItem value="today">Within 24 hours</SelectItem>
                <SelectItem value="1d">≤ 1 day</SelectItem>
                <SelectItem value="3d">≤ 3 days</SelectItem>
                <SelectItem value="5d">≤ 5 days</SelectItem>
                <SelectItem value="7d">≤ 7 days</SelectItem>
                <SelectItem value="30d">≤ 30 days</SelectItem>
                <SelectItem value="30d+">More than 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="h-9 w-full sm:w-[220px]">
                <SelectValue placeholder="Sort: default order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sort: default order</SelectItem>
                <SelectItem value="remaining-desc">
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                    High → Low remaining
                  </span>
                </SelectItem>
                <SelectItem value="remaining-asc">
                  <span className="inline-flex items-center gap-2">
                    <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                    Low → High remaining
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {(statusFilter !== "all" || remainingFilter !== "all" || sortOrder !== "none") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setRemainingFilter("all");
                  setSortOrder("none");
                }}
                className="h-9 border-border"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sunset/10">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{bots.length === 0 ? "No APPLICATIONs yet" : "No matches"}</p>
            <p className="text-sm text-muted-foreground">
              {bots.length === 0 ? "Create your first APPLICATION to get started." : "Try a different search term."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">APPLICATION Name</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">API</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                    <th className="px-4 py-3 font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Block</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {filtered.map((b) => {
                      const status = getBotStatus(b);
                      const url = apiUrl(b);
                      const preview = previewUrl(b);
                      return (
                        <motion.tr
                          key={b.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{b.name}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-default">{truncateChars(b.description, 15)}</span>
                              </TooltipTrigger>
                              {b.description && b.description.trim().length > 15 && (
                                <TooltipContent className="max-w-xs">{b.description}</TooltipContent>
                              )}
                            </Tooltip>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{b.id}</code>
                              <CopyBtn value={b.id} label="ID" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                                {url.length > 28 ? `${url.slice(0, 28)}…` : url}
                              </code>
                              <CopyBtn value={url} label="API URL" />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={preview}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Open live preview</TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(b.expiryDate)}</td>
                          <td className="px-4 py-3 text-sm font-medium">
                            <Countdown expiryIso={b.expiryDate} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3">
                            <Switch
                              checked={b.blocked}
                              onCheckedChange={(checked) => {
                                botsStore.update(b.id, { blocked: checked });
                                toast.success(checked ? "APPLICATION blocked" : "APPLICATION unblocked");
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => onEdit(b)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setToDelete(b)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              <AnimatePresence initial={false}>
                {filtered.map((b) => {
                  const status = getBotStatus(b);
                  const url = apiUrl(b);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="rounded-xl border border-border/60 bg-background p-3 shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{b.name}</div>
                          <p className="text-xs text-muted-foreground">{truncateChars(b.description, 15)}</p>
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">ID</span>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-muted px-2 py-0.5 font-mono">{b.id}</code>
                            <CopyBtn value={b.id} label="ID" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">API</span>
                          <div className="flex items-center gap-1">
                            <code className="truncate rounded bg-muted px-2 py-0.5 font-mono">
                              {url.slice(0, 14)}…
                            </code>
                            <CopyBtn value={url} label="API URL" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Expiry</span>
                          <span>{formatDateTime(b.expiryDate)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Remaining</span>
                          <Countdown expiryIso={b.expiryDate} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={b.blocked}
                            onCheckedChange={(c) => {
                              botsStore.update(b.id, { blocked: c });
                              toast.success(c ? "APPLICATION blocked" : "APPLICATION unblocked");
                            }}
                          />
                          <span className="text-muted-foreground">Block</span>
                        </label>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => onEdit(b)}>
                            <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setToDelete(b)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this APPLICATION?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-semibold">{toDelete?.name}</span> ({toDelete?.id}) and its
              API endpoint. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  botsStore.remove(toDelete.id);
                  toast.success("APPLICATION deleted");
                  setToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
