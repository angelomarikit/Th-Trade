import type { NewsItem, ScoreWithReasons } from "../types.js";

const BULLISH = [
  /\bbeat(s|ing)?\b/i,
  /\brais(e|es|ed|ing)\b/i,
  /\bupgrade(d|s)?\b/i,
  /\bsurge(s|d)?\b/i,
  /\brecord\b/i,
  /\bstrong\b/i,
  /\bbullish\b/i,
  /\bbuyback\b/i,
  /\bapproval\b/i,
  /\bpartnership\b/i,
  /\boutperform\b/i,
];

const BEARISH = [
  /\bmiss(es|ed|ing)?\b/i,
  /\bcut(s|ting)?\b/i,
  /\bdowngrade(d|s)?\b/i,
  /\bweak\b/i,
  /\bbearish\b/i,
  /\blawsuit\b/i,
  /\binvestigation\b/i,
  /\bdilution\b/i,
  /\boffering\b/i,
  /\bresign(s|ed|ation)?\b/i,
  /\bprobe\b/i,
  /\bfraud\b/i,
];

/**
 * Directional sentiment -100..+100 from keyword heuristics.
 * NOT a probability the stock goes up. Not used alone for ENTRY ACTIVE.
 */
export function scoreDirectionalSentiment(items: NewsItem[]): ScoreWithReasons {
  if (items.length === 0) {
    return { score: 0, reasons: ["No items"] };
  }

  const primary = [...items].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
  )[0]!;
  const text = `${primary.headline} ${primary.summary ?? ""}`;

  let bull = 0;
  let bear = 0;
  const hitBull: string[] = [];
  const hitBear: string[] = [];

  for (const p of BULLISH) {
    if (p.test(text)) {
      bull += 1;
      hitBull.push(p.source);
    }
  }
  for (const p of BEARISH) {
    if (p.test(text)) {
      bear += 1;
      hitBear.push(p.source);
    }
  }

  const raw = (bull - bear) * 25;
  const score = Math.max(-100, Math.min(100, raw));
  const reasons = [
    `Keyword lean bull=${bull} bear=${bear} on earliest cluster headline`,
    "Sentiment is directional lean only — not win probability and never sole entry criterion",
  ];
  if (hitBull.length) reasons.push(`Bullish cues: ${hitBull.slice(0, 4).join(", ")}`);
  if (hitBear.length) reasons.push(`Bearish cues: ${hitBear.slice(0, 4).join(", ")}`);
  if (bull === 0 && bear === 0) reasons.push("No strong directional keywords — neutral");

  return { score, reasons };
}
