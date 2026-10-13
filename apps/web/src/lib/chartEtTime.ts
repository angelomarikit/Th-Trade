import { TickMarkType, type Time } from "lightweight-charts";
import { formatEtChartTime } from "./format";

export function timeToUtcSec(time: Time): number | null {
  if (typeof time === "number") return time;
  if (typeof time === "string") {
    const ms = Date.parse(time);
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
  }
  if (typeof time === "object" && time !== null && "year" in time) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return null;
}

const etParts = (utcSec: number) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcSec * 1000));

export function formatEtChartTick(time: Time, tickMarkType: TickMarkType): string {
  const sec = timeToUtcSec(time);
  if (sec == null) return "";
  const d = new Date(sec * 1000);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(d);
    case TickMarkType.Month:
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short" }).format(d);
    case TickMarkType.DayOfMonth:
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", day: "numeric" }).format(d);
    case TickMarkType.TimeWithSeconds:
      return (
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(d) + " ET"
      );
    case TickMarkType.Time:
    default:
      return `${formatEtChartTime(sec)} ET`;
  }
}

export function formatLastBarEtLabel(utcSec: number): string {
  const parts = etParts(utcSec);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${pick("hour")}:${pick("minute")} ET`;
}

export const chartEtLocalization = {
  locale: "en-US" as const,
  timeFormatter: (time: Time) => {
    const sec = timeToUtcSec(time);
    return sec == null ? "" : `${formatEtChartTime(sec)} ET`;
  },
};
