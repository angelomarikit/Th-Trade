/** Shared signal/status chip — never invents outcomes. */
export function StatusBadge(props: {
  status: string;
  className?: string;
}) {
  const tone = toneFor(props.status);
  return (
    <span className={`badge status-badge ${tone} ${props.className ?? ""}`.trim()}>
      {normalizeStatus(props.status)}
    </span>
  );
}

export function normalizeStatus(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return "ENTRY ACTIVE";
  if (u.includes("NEAR ACTIVE")) return "NEAR ACTIVE";
  if (u.includes("MISSED")) return "MISSED";
  if (u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("TARGET HIT")) return u.includes("T2") ? "TARGET HIT (T2)" : u.includes("T3") ? "TARGET HIT (T3)" : "TARGET HIT (T1)";
  if (u.includes("STOP HIT")) return "STOP HIT";
  if (u.includes("DATA NOT VERIFIED") || u.includes("DATA_NOT")) return "DATA NOT VERIFIED";
  if (u.includes("NO TRADE") || u.includes("NO_TRADE")) return "NO TRADE";
  if (u.includes("SETUP")) return "SETUP";
  if (u.includes("WATCH")) return "WATCH";
  if (u.includes("WAIT")) return "WAIT";
  if (u.includes("SCANNING")) return "SCANNING";
  return status || "—";
}

function toneFor(status: string): string {
  const u = status.toUpperCase();
  if (u === "LONG" || u.includes("ENTRY ACTIVE") || u.includes("SETUP")) return "green";
  if (u === "SHORT") return "red";
  if (u.includes("NEAR ACTIVE") || u.includes("WAIT") || u.includes("WATCH")) return "amber";
  if (u.includes("TARGET HIT")) return "green";
  if (u.includes("MISSED") || u.includes("INVALIDATED") || u.includes("NO TRADE") || u.includes("STOP"))
    return "red";
  if (u.includes("DATA")) return "amber";
  return "";
}
