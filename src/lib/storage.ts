// Frontend-only storage layer using localStorage.
// Simulates a backend for users, OTPs, and BOTs.

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
};

export type Bot = {
  id: string; // 8-char unique
  ownerId: string;
  name: string;
  description: string;
  expiryDate: string; // ISO
  blocked: boolean;
  apiKey: string; // for protected endpoint
  createdAt: string;
};

export type BotStatus = "active" | "expired" | "blocked";

const KEYS = {
  users: "bvm_users",
  bots: "bvm_bots",
  session: "bvm_session",
  otps: "bvm_otps",
} as const;

// Tiny non-cryptographic hash — purely for demo. Do NOT use in real apps.
export function hashPassword(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h) ^ pw.charCodeAt(i);
  return `h_${(h >>> 0).toString(36)}_${pw.length}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  // Notify same-tab listeners
  window.dispatchEvent(new CustomEvent("bvm:change", { detail: { key } }));
}

// ---------- Users ----------
export const usersStore = {
  all(): User[] {
    return read<User[]>(KEYS.users, []);
  },
  byEmail(email: string): User | undefined {
    return this.all().find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  byId(id: string): User | undefined {
    return this.all().find((u) => u.id === id);
  },
  create(u: User) {
    const all = this.all();
    all.push(u);
    write(KEYS.users, all);
  },
  update(id: string, patch: Partial<User>) {
    const all = this.all().map((u) => (u.id === id ? { ...u, ...patch } : u));
    write(KEYS.users, all);
  },
};

// ---------- Session ----------
export const sessionStore = {
  get(): { userId: string } | null {
    return read<{ userId: string } | null>(KEYS.session, null);
  },
  set(userId: string) {
    write(KEYS.session, { userId });
  },
  clear() {
    write(KEYS.session, null);
  },
};

// ---------- OTP ----------
type OtpRecord = { code: string; purpose: string; email: string; expires: number; payload?: any };
export const otpStore = {
  all(): OtpRecord[] {
    return read<OtpRecord[]>(KEYS.otps, []);
  },
  generate(email: string, purpose: string, payload?: any): string {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const all = this.all().filter((o) => !(o.email === email && o.purpose === purpose));
    all.push({ code, purpose, email, expires: Date.now() + 10 * 60 * 1000, payload });
    write(KEYS.otps, all);
    return code;
  },
  verify(email: string, purpose: string, code: string): { ok: boolean; payload?: any } {
    const all = this.all();
    const rec = all.find(
      (o) => o.email === email && o.purpose === purpose && o.code === code && o.expires > Date.now(),
    );
    if (!rec) return { ok: false };
    write(
      KEYS.otps,
      all.filter((o) => o !== rec),
    );
    return { ok: true, payload: rec.payload };
  },
};

// ---------- BOTs ----------
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomId(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}
function randomKey(): string {
  let s = "";
  for (let i = 0; i < 32; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s.toLowerCase();
}

export const botsStore = {
  all(): Bot[] {
    return read<Bot[]>(KEYS.bots, []);
  },
  byOwner(ownerId: string): Bot[] {
    return this.all().filter((b) => b.ownerId === ownerId);
  },
  byId(id: string): Bot | undefined {
    return this.all().find((b) => b.id === id);
  },
  generateUniqueId(): string {
    const existing = new Set(this.all().map((b) => b.id));
    let id = randomId();
    while (existing.has(id)) id = randomId();
    return id;
  },
  create(input: { ownerId: string; name: string; description: string; expiryDate: string }): Bot {
    const bot: Bot = {
      id: this.generateUniqueId(),
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      expiryDate: input.expiryDate,
      blocked: false,
      apiKey: randomKey(),
      createdAt: new Date().toISOString(),
    };
    write(KEYS.bots, [...this.all(), bot]);
    return bot;
  },
  update(id: string, patch: Partial<Omit<Bot, "id" | "ownerId">>) {
    write(
      KEYS.bots,
      this.all().map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  },
  remove(id: string) {
    write(
      KEYS.bots,
      this.all().filter((b) => b.id !== id),
    );
  },
};

export function getBotStatus(b: Bot): BotStatus {
  if (b.blocked) return "blocked";
  if (new Date(b.expiryDate).getTime() < Date.now()) return "expired";
  return "active";
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
