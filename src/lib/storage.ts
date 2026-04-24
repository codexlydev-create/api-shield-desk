// Hybrid Bot/Application store.
// - When the backend API is reachable AND the user is authenticated, all reads/writes
//   go through the API (and the local cache is kept in sync as a fallback).
// - When the backend is offline (no DB / no server), everything falls back to
//   localStorage so the app keeps working. As soon as the API comes back online,
//   any locally-created/edited/deleted records are flushed to the server.

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
let lastFetchAt = 0;

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
        await applicationsApi.remove(realId);
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

async function syncFromServer(force = false): Promise<Application[] | null> {
  const token = tokenStore.get();
  if (!token) return null;
  if (!isOnline()) return null;
  if (syncing) return null;
  if (!force && Date.now() - lastFetchAt < 4000) return null;
  syncing = true;
  try {
    await flushPending();
    const res = await applicationsApi.list();
    writeCache(res.applications);
    lastFetchAt = Date.now();
    emit();
    return res.applications;
  } catch {
    return null;
  } finally {
    syncing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncFromServer(true);
  });
  window.addEventListener("avm:auth", () => {
    void syncFromServer(true);
  });
}

export const botsStore = {
  /** Synchronous read from the local cache. Triggers a background server sync. */
  byOwner(ownerId: string): Application[] {
    void syncFromServer();
    return readCache().filter((b) => b.ownerId === ownerId || b.ownerId === "local");
  },
  byId(id: string): Application | undefined {
    void syncFromServer();
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
    void syncFromServer(true);
    return optimistic;
  },
  update(id: string, patch: Partial<Pick<Application, "name" | "description" | "expiryDate" | "blocked">>) {
    const cache = readCache().map((b) => (b.id === id ? { ...b, ...patch } : b));
    writeCache(cache);
    addPending({ kind: "update", id, patch });
    emit();
    void syncFromServer(true);
  },
  remove(id: string) {
    const cache = readCache().filter((b) => b.id !== id);
    writeCache(cache);
    addPending({ kind: "delete", id });
    emit();
    void syncFromServer(true);
  },
  /** Force a refresh from the server. */
  refresh: () => syncFromServer(true),
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
