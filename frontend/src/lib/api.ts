const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "worklog_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: (): string | null => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

type Params = Record<string, string | number | boolean | null | undefined>;

export function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) {
      return d
        .map((x: { msg?: string; loc?: (string | number)[] }) => {
          const field = x.loc?.[x.loc.length - 1];
          const msg = (x.msg || "Invalid value").replace(/^Value error, /, "");
          return field && field !== "body" ? `${String(field).replace(/_/g, " ")}: ${msg}` : msg;
        })
        .join("; ");
    }
  }
  return fallback;
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }
  if (res.status === 401 && token) {
    tokenStore.clear();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      // Outside React (no router here); a full reload also clears stale state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?expired=1";
    }
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, errorMessage(body, `Request failed (${res.status})`));
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>(path + qs(params)),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),

  /** Download a file from an authenticated endpoint. */
  async download(path: string, params?: Params): Promise<void> {
    const res = await raw(path + qs(params));
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename="?([^"]+)"?/.exec(cd);
    const name = match?.[1] || "download";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
