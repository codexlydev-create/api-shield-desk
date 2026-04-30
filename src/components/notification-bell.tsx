import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  applicationsApi,
  devicesApi,
  type Application,
  type Device,
} from "@/lib/api";

const SEEN_KEY = "avm_seen_devices";

type SeenMap = Record<string, true>;

function loadSeen(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as SeenMap;
  } catch {
    return {};
  }
}

function saveSeen(seen: SeenMap) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState<
    Array<Device & { applicationName: string }>
  >([]);
  const [seen, setSeen] = useState<SeenMap>(() => loadSeen());
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOnce = useMemo(
    () => async () => {
      try {
        const { applications } = await applicationsApi.list();
        const all = await Promise.all(
          applications.map(async (app: Application) => {
            try {
              const res = await devicesApi.listOwned(app.id);
              return res.devices.map((d) => ({
                ...d,
                applicationName: app.name,
              }));
            } catch {
              return [];
            }
          }),
        );
        const flat = all.flat().filter((d) => d.status === "pending");
        // newest first
        flat.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setPending(flat);
      } catch {
        // silent — bell is best-effort
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    fetchOnce();
    timer.current = setInterval(fetchOnce, 15000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled, fetchOnce]);

  const unreadCount = pending.filter((d) => !seen[d.id]).length;

  const markAllSeen = () => {
    const next: SeenMap = { ...seen };
    pending.forEach((d) => {
      next[d.id] = true;
    });
    setSeen(next);
    saveSeen(next);
  };

  if (!enabled) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // mark all as seen when the popover opens
          // (matches typical bell behaviour)
          setTimeout(markAllSeen, 600);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <div className="text-sm font-semibold">Device requests</div>
          <span className="text-xs text-muted-foreground">
            {pending.length} pending
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Check className="h-5 w-5 text-success" />
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {pending.map((d) => (
                <li key={d.id} className="p-3 hover:bg-muted/30">
                  <Link
                    to="/application/$applicationId"
                    params={{ applicationId: d.applicationId }}
                    onClick={() => setOpen(false)}
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {d.deviceName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d.applicationName} ·{" "}
                          {new Date(d.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {!seen[d.id] && (
                        <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-destructive" />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pending.length > 0 && (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-1 text-xs"
              onClick={markAllSeen}
            >
              <X className="h-3 w-3" /> Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
