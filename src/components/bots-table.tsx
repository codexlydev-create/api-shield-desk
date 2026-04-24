import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Edit2, ExternalLink, Search, Trash2 } from "lucide-react";
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

function firstWords(text: string, n = 3): string {
  if (!text) return "—";
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return words.join(" ");
  return `${words.slice(0, n).join(" ")}…`;
}

function daysRemaining(expiryIso: string): number {
  const ms = new Date(expiryIso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function DaysRemaining({ expiryIso }: { expiryIso: string }) {
  const days = daysRemaining(expiryIso);
  if (days < 0)
    return <span className="text-destructive">Expired {Math.abs(days)}d ago</span>;
  if (days === 0) return <span className="text-warning-foreground">Today</span>;
  const tone = days <= 7 ? "text-warning-foreground" : "text-foreground";
  return (
    <span className={tone}>
      {days} {days === 1 ? "day" : "days"}
    </span>
  );
}

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

  useEffect(() => {
    const refresh = () => setBots(botsStore.byOwner(ownerId));
    refresh();
    const handler = () => refresh();
    window.addEventListener("bvm:change", handler);
    window.addEventListener("storage", handler);
    // tick every 30s so expired status updates live
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      window.removeEventListener("bvm:change", handler);
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, [ownerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  }, [bots, search]);

  const apiUrl = (b: Bot) =>
    typeof window !== "undefined" ? `${window.location.origin}/api/bot/${b.id}` : `/api/bot/${b.id}`;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-2xl border border-border/60 bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your BOTs</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {bots.length} {bots.length === 1 ? "BOT" : "BOTs"}
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

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sunset/10">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{bots.length === 0 ? "No BOTs yet" : "No matches"}</p>
            <p className="text-sm text-muted-foreground">
              {bots.length === 0 ? "Create your first BOT to get started." : "Try a different search term."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">BOT Name</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">API</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                    <th className="px-4 py-3 font-medium">Days Left</th>
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
                            <div className="line-clamp-1 text-xs text-muted-foreground">{b.description || "—"}</div>
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
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Open endpoint</TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDateTime(b.expiryDate)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3">
                            <Switch
                              checked={b.blocked}
                              onCheckedChange={(checked) => {
                                botsStore.update(b.id, { blocked: checked });
                                toast.success(checked ? "BOT blocked" : "BOT unblocked");
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
                          <p className="line-clamp-2 text-xs text-muted-foreground">{b.description || "—"}</p>
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
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={b.blocked}
                            onCheckedChange={(c) => {
                              botsStore.update(b.id, { blocked: c });
                              toast.success(c ? "BOT blocked" : "BOT unblocked");
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
            <AlertDialogTitle>Delete this BOT?</AlertDialogTitle>
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
                  toast.success("BOT deleted");
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
