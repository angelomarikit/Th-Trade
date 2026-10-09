export function fmtPrice(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtR(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}R`;
}

export function ageLabel(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function formatEtClock(d: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d) + " ET"
  );
}

export function statusTag(status: string): "PASS" | "FAIL" | "WAIT" | "UNKNOWN" {
  const s = status.toUpperCase();
  if (s.includes("PASS")) return "PASS";
  if (s.includes("FAIL")) return "FAIL";
  if (s.includes("PENDING") || s.includes("WAIT")) return "WAIT";
  if (s.includes("UNKNOWN") || s.includes("N/A") || s.includes("SKIP")) return "UNKNOWN";
  return "UNKNOWN";
}
