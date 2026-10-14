/** Regular US equity session: 09:30–16:00 America/New_York, weekdays. */

export function isRegularSessionBarStart(timestamp: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(fmt.formatToParts(timestamp).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
  const weekday = bag.weekday ?? "";
  if (weekday === "Sat" || weekday === "Sun") return false;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}
