/** Regular session 09:30–16:00 America/New_York. Bars that start at 16:00 or later are after the close. */

export function isRegularSessionBarStart(unixSeconds: number): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(new Date(unixSeconds * 1000)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekday = bag.weekday ?? "";
  if (weekday === "Sat" || weekday === "Sun") return false;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const mins = hour * 60 + Number(bag.minute);
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function keepRegularSession<T extends { time: number }>(bars: T[], timeframe: string): T[] {
  if (timeframe.toLowerCase() === "1d") return bars;
  return bars.filter((b) => isRegularSessionBarStart(b.time));
}

/** How many regular-session bars to keep on the chart. */
export function historyLimit(timeframe: string): number {
  switch (timeframe.toLowerCase()) {
    case "1m":
      return 800;
    case "15m":
      return 220;
    case "1d":
      return 120;
    default:
      return 400;
  }
}
