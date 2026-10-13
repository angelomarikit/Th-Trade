/**
 * Shared API origin for web fetches.
 * Preview builds must bake the same Railway URL as production; empty base causes
 * same-origin SPA HTML responses and Safari "string did not match the expected pattern".
 */
const FALLBACK_PROD_API = "https://th-trade-production.up.railway.app";

const raw = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");

export const API_BASE =
  raw || (import.meta.env.PROD ? FALLBACK_PROD_API : "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) {
    throw new Error("API is not configured. Set VITE_API_BASE for local development.");
  }
  return `${API_BASE}${p}`;
}

/** Map raw fetch/parse/browser errors to short customer-safe copy. */
export function friendlyApiError(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  ) {
    return "Cannot reach market data API. Check your connection and try again.";
  }
  if (
    lower.includes("did not match the expected pattern") ||
    lower.includes("unexpected token") ||
    lower.includes("<!doctype") ||
    lower.includes("is not valid json") ||
    lower.includes("json.parse")
  ) {
    return "Market data connection is misconfigured. Please refresh or contact support.";
  }
  if (lower.includes("api is not configured")) {
    return "Market data API is not configured for this deploy.";
  }
  if (lower.includes("http 401") || lower.includes("unauthorized")) {
    return "Session expired. Please sign in again.";
  }
  if (lower.includes("http 403") || lower.includes("forbidden")) {
    return "You do not have access to this data.";
  }
  if (lower.includes("http 429")) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (lower.includes("http 5")) {
    return "Market data API is temporarily unavailable.";
  }
  // Strip huge HTML / JSON dump bodies
  if (rawMsg.length > 180 || rawMsg.trimStart().startsWith("<")) {
    return "Something went wrong loading market data. Please try again.";
  }
  return rawMsg;
}
