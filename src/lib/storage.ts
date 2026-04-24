// Hybrid Bot/Application store.
// - Writes are applied optimistically to a local cache AND queued as pending ops.
// - When the backend API is reachable AND the user is authenticated, pending
//   ops are flushed to the server, then the server's list becomes the new
//   source of truth (merged with any still-pending local changes).
// - When the backend is offline, everything keeps working from localStorage
//   and the queue drains automatically the moment connectivity returns.

import { applicationsApi, tokenStore, type Application } from "./api";

export {
  type Application as Bot,
  type ApplicationStatus as BotStatus,
  type User,
  getApplicationStatus as getBotStatus,
  formatDateTime,
} from "./api";

const CACHE_KEY = "avm_bots_cache_v1";
const PENDING_KEY = "avm_bots_pending_v1";
const TOMBSTONE_KEY = "avm_bots_tombstones_v1";

type PendingOp =
  | { kind: "create"; tempId: string; ownerId: string; name: string; description: string; expiryDate: string }
  | { kind: "update"; id: string; patch: Partial<Pick<Application, "name" | "description" | "expiryDate" | "blocked">> }
  | { kind: "delete"; id: string };

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bvm:change"));
  }
}

function readCache(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

function writeCache(list: Application[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(list));
}

function readPending(): PendingOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function writePending(ops: PendingOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, JSON.stringify(ops));
}

function addPending(op: PendingOp) {
  const ops = readPending();
  ops.push(op);
  writePending(ops);
}

// Tombstones: IDs that the user deleted locally but which may still exist on
// the server until the next flush. Used to prevent the server's list response
// from resurrecting a deleted row in the UI.
function readTombstones(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeTombstones(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(ids));
}

function addTombstone(id: string) {
  const t = readTombstones();
  if (!t.includes(id)) {
    t.push(id);
    writeTombstones(t);
  }
}

function clearTombstone(id: string) {
  writeTombstones(readTombstones().filter((x) => x !== id));
}

function randomLocalId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "local-";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

let syncing = false;

async function flushPending() {
  const token = tokenStore.get();
  if (!token) return;
  const ops = readPending();
  if (ops.length === 0) return;
  const remaining: PendingOp[] = [];
  const idMap: Record<string, string> = {};
  for (const op of ops) {
    try {
      if (op.kind === "create") {
        const res = await applicationsApi.create({
          name: op.name,
          description: op.description,
          expiryDate: op.expiryDate,
        });
        idMap[op.tempId] = res.application.id;
      } else if (op.kind === "update") {
        const realId = idMap[op.id] ?? op.id;
        await applicationsApi.update(realId, op.patch);
      } else if (op.kind === "delete") {
        const realId = idMap[op.id] ?? op.id;
        try {
          await applicationsApi.remove(realId);
        } catch (err) {
          // If the item was never on the server (e.g. create never flushed
          // because the user went offline first), a 404 is a success for us.
          const status = (err as { status?: number })?.status;
          if (status !== 404) throw err;
        }
        clearTombstone(op.id);
        clearTombstone(realId);
      }
    } catch {
      // Keep it pending; we'll retry next sync.
      remaining.push(op);
    }
  }
  writePending(remaining);
  // Rewrite cache: replace temp ids with real ids if we created them.
  if (Object.keys(idMap).length > 0) {
    const cache = readCache().map((b) => (idMap[b.id] ? { ...b, id: idMap[b.id] } : b));
    writeCache(cache);
  }
}

/**
 * Merge the authoritative server list with local pending changes so the UI
 * never "flashes back" to stale data while ops are still queued.
 */
function mergeServerList(server: Application[]): Application[] {
  const pending = readPending();
  const tombstones = new Set(readTombstones());

  // Start with the server list, drop anything the user has deleted locally.
  const byId = new Map<string, Application>();
  for (const a of server) {
    if (!tombstones.has(a.id)) byId.set(a.id, a);
  }

  // Re-apply queued local changes on top.
  for (const op of pending) {
    if (op.kind === "create") {
      // Keep the optimistic temp record until the create flushes.
      if (!Array.from(byId.values()).some((a) => a.id === op.tempId)) {
        byId.set(op.tempId, {
          id: op.tempId,
          ownerId: op.ownerId || "local",
          name: op.name,
          description: op.description,
          expiryDate: op.expiryDate,
          blocked: false,
          apiKey: "pending",
          createdAt: new Date().toISOString(),
        });
      }
    } else if (op.kind === "update") {
      const cur = byId.get(op.id);
      if (cur) byId.set(op.id, { ...cur, ...op.patch });
    } else if (op.kind === "delete") {
      byId.delete(op.id);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

async function syncFromServer(): Promise<Application[] | null> {
  const token = tokenStore.get();
  if (!token) return null;
  if (!isOnline()) return null;
  if (syncing) return null;
  syncing = true;
  try {
    await flushPending();
    const res = await applicationsApi.list();
    const merged = mergeServerList(res.applications);
    writeCache(merged);
    emit();
    return merged;
  } catch {
    return null;
  } finally {
    syncing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncFromServer();
  });
  window.addEventListener("avm:auth", () => {
    void syncFromServer();
  });
}

export const botsStore = {
  /** Synchronous read from the local cache. Triggers a background server sync. */
  byOwner(ownerId: string): Application[] {
    void syncFromServer();
    const tombstones = new Set(readTombstones());
    return readCache().filter(
      (b) => (b.ownerId === ownerId || b.ownerId === "local") && !tombstones.has(b.id),
    );
  },
  byId(id: string): Application | undefined {
    void syncFromServer();
    if (readTombstones().includes(id)) return undefined;
    return readCache().find((b) => b.id === id);
  },
  create(input: { ownerId: string; name: string; description: string; expiryDate: string }): Application {
    const tempId = randomLocalId();
    const optimistic: Application = {
      id: tempId,
      ownerId: input.ownerId || "local",
      name: input.name,
      description: input.description,
      expiryDate: input.expiryDate,
      blocked: false,
      apiKey: "pending",
      createdAt: new Date().toISOString(),
    };
    const cache = readCache();
    cache.unshift(optimistic);
    writeCache(cache);
    addPending({
      kind: "create",
      tempId,
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      expiryDate: input.expiryDate,
    });
    emit();
    void syncFromServer();
    return optimistic;
  },
  update(id: string, patch: Partial<Pick<Application, "name" | "description" | "expiryDate" | "blocked">>) {
    const cache = readCache().map((b) => (b.id === id ? { ...b, ...patch } : b));
    writeCache(cache);
    addPending({ kind: "update", id, patch });
    emit();
    void syncFromServer();
  },
  remove(id: string) {
    const cache = readCache().filter((b) => b.id !== id);
    writeCache(cache);
    addTombstone(id);
    addPending({ kind: "delete", id });
    emit();
    void syncFromServer();
  },
  /** Force a refresh from the server. */
  refresh: () => syncFromServer(),
};

// Session helpers used by route guards. The auth-context owns the real state;
// this just exposes a synchronous "is there a token?" check for beforeLoad.
export const sessionStore = {
  get(): { token: string } | null {
    const token = tokenStore.get();
    return token ? { token } : null;
  },
  clear() {
    tokenStore.clear();
  },
};
