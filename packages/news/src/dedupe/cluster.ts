import type { NewsItem } from "../types.js";

const WINDOW_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Cluster duplicate stories into events.
 * Importance must not rise merely because many sites repeat the same report.
 */
export function clusterNewsItems(items: NewsItem[]): NewsItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
  );
  const clusters: NewsItem[][] = [];
  const assigned = new Set<string>();

  for (const item of sorted) {
    if (assigned.has(item.id)) continue;

    const cluster: NewsItem[] = [item];
    assigned.add(item.id);

    for (const other of sorted) {
      if (assigned.has(other.id)) continue;
      if (!sameStory(item, other)) continue;
      cluster.push(other);
      assigned.add(other.id);
    }
    clusters.push(cluster);
  }

  return clusters;
}

/** True when two items are the same underlying story (syndication / rewrites). */
export function sameStory(a: NewsItem, b: NewsItem): boolean {
  if (!tickerOverlap(a.tickers, b.tickers) && a.tickers.length && b.tickers.length) {
    return false;
  }
  const dt = Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime());
  if (dt > WINDOW_MS) return false;

  const ha = normalizeHeadline(a.headline);
  const hb = normalizeHeadline(b.headline);
  if (ha === hb) return true;
  if (ha.includes(hb) || hb.includes(ha)) return true;

  const sigA = signature(a);
  const sigB = signature(b);
  return similarity(sigA, sigB) >= 0.45;
}

export function normalizeHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function signature(item: NewsItem): string[] {
  return tokenize(`${item.headline} ${item.summary ?? ""}`);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const t of a) if (setB.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

function tickerOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  const setB = new Set(b);
  return a.some((t) => setB.has(t));
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "after",
  "into",
  "over",
  "under",
  "says",
  "said",
  "will",
  "has",
  "have",
  "its",
  "are",
  "was",
  "were",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "by",
  "as",
  "at",
  "or",
  "be",
]);
