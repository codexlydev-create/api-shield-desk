// HTTP API client that talks to the Express backend (see /backend).
// Set VITE_API_URL in the frontend .env (default: http://localhost:4000).

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

export type Application = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  expiryDate: string;
  blocked: boolean;
  apiKey: string;
  createdAt: string;
};

export type ApplicationStatus = "active" | "expired" | "blocked";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:4000";

const TOKEN_KEY = "avm_token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new CustomEvent("avm:auth"));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent("avm:auth"));
  },
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth) {
    const token = tokenStore.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

// ---------- Auth ----------
export const authApi = {
  registerStart: (input: { name: string; email: string; password: string }) =>
    request<{ ok: true }>("/api/auth/register/start", { method: "POST", body: input }),
  registerVerify: (input: { email: string; code: string }) =>
    request<{ token: string; user: User }>("/api/auth/register/verify", { method: "POST", body: input }),
  login: (input: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: input }),
  forgotStart: (input: { email: string }) =>
    request<{ ok: true }>("/api/auth/forgot/start", { method: "POST", body: input }),
  forgotVerify: (input: { email: string; code: string; password: string }) =>
    request<{ ok: true }>("/api/auth/forgot/verify", { method: "POST", body: input }),
  me: () => request<{ user: User }>("/api/profile/me", { auth: true }),
};

// ---------- Profile ----------
export const profileApi = {
  changeEmailStart: (input: { newEmail: string }) =>
    request<{ ok: true }>("/api/profile/email/start", { method: "POST", body: input, auth: true }),
  changeEmailVerify: (input: { newEmail: string; code: string }) =>
    request<{ user: User }>("/api/profile/email/verify", { method: "POST", body: input, auth: true }),
  changePassword: (input: { current: string; next: string }) =>
    request<{ ok: true }>("/api/profile/password", { method: "POST", body: input, auth: true }),
};

// ---------- Applications ----------
export const applicationsApi = {
  list: () => request<{ applications: Application[] }>("/api/applications", { auth: true }),
  create: (input: { name: string; description: string; expiryDate: string }) =>
    request<{ application: Application }>("/api/applications", { method: "POST", body: input, auth: true }),
  update: (
    id: string,
    input: Partial<{ name: string; description: string; expiryDate: string; blocked: boolean }>,
  ) =>
    request<{ application: Application }>(`/api/applications/${id}`, {
      method: "PATCH",
      body: input,
      auth: true,
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/applications/${id}`, { method: "DELETE", auth: true }),
};

// ---------- Public ----------
export type PublicApplicationResponse = {
  id: string;
  expiry_date: string;
  status: ApplicationStatus;
  remaining_time: string;
  remaining: { days: number; hours: number; minutes: number; seconds: number };
  error?: string;
};
export const publicApi = {
  getApplication: (id: string) =>
    request<PublicApplicationResponse>(`/api/public/applications/${id}`),
};

// ---------- Contact ----------
export const contactApi = {
  send: (input: { name: string; email: string; message: string }) =>
    request<{ ok: true }>("/api/contact", { method: "POST", body: input }),
};

// ---------- Helpers ----------
export function getApplicationStatus(a: Application): ApplicationStatus {
  if (a.blocked) return "blocked";
  if (new Date(a.expiryDate).getTime() < Date.now()) return "expired";
  return "active";
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Backwards-compatible aliases for existing imports.
export type Bot = Application;
export type BotStatus = ApplicationStatus;
export const getBotStatus = getApplicationStatus;
export { ApiError };
