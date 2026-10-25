/** Regular session 09:30–16:00 America/New_York. Bars that start at 16:00 or later are after the close. */

function etSessionParts(date: Date): { weekday: string; mins: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return { weekday: bag.weekday ?? "", mins: hour * 60 + Number(bag.minute) };
}

/** True when US equity regular hours are open right now (ET). */
export function isUsEquityRthNow(now = new Date()): boolean {
  const { weekday, mins } = etSessionParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function isRegularSessionBarStart(unixSeconds: number): boolean {
  const { weekday, mins } = etSessionParts(new Date(unixSeconds * 1000));
  if (weekday === "Sat" || weekday === "Sun") return false;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function keepRegularSession<T extends { time: number }>(bars: T[], timeframe: string): T[] {
  if (timeframe.toLowerCase() === "1d") return bars;
  return bars.filter((b) => b != null && isRegularSessionBarStart(b.time));
}

export function barsForChart<T extends { time: number; close: number }>(
  bars: T[],
  timeframe: string,
  extendedHours: boolean,
): T[] {
  const clean = bars.filter((b) => b != null && Number.isFinite(b.close));
  return extendedHours ? clean : keepRegularSession(clean, timeframe);
}

/** How many regular-session bars to keep on the chart. */
/** Mock/lab preview always loads extended-hours bars so the chart is not empty off RTH. */
export function chartUsesExtendedSession(
  extendedHours: boolean,
  labTestDataMode: boolean,
  mockTradingMode: boolean,
  mockLiveRthMode: boolean,
): boolean {
  if (mockLiveRthMode && (mockTradingMode || labTestDataMode)) {
    return extendedHours;
  }
  return extendedHours || labTestDataMode || mockTradingMode;
}

export function historyLimit(timeframe: string): number {
  switch (timeframe.toLowerCase()) {
    case "1m":
      return 800;
    case "15m":
      return 220;
    case "1h":
      return 180;
    case "1d":
      return 120;
    default:
      return 400;
  }
}
