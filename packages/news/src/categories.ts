export const CATALYST_CATEGORIES = [
  "EARNINGS",
  "GUIDANCE",
  "ANALYST_UPGRADE",
  "ANALYST_DOWNGRADE",
  "PRICE_TARGET_CHANGE",
  "SEC_FILING",
  "FORM_8K",
  "FORM_10Q",
  "FORM_10K",
  "MA",
  "FDA",
  "REGULATORY",
  "LAWSUIT",
  "GOVERNMENT_CONTRACT",
  "PRODUCT_ANNOUNCEMENT",
  "PARTNERSHIP",
  "MANAGEMENT_CHANGE",
  "SHARE_OFFERING",
  "BUYBACK",
  "DIVIDEND",
  "STOCK_SPLIT",
  "INSIDER_ACTIVITY",
  "MACRO",
  "FED",
  "CPI",
  "PPI",
  "JOBS",
  "RATE_DECISION",
  "GEOPOLITICAL",
  "SECTOR_NEWS",
  "OTHER",
] as const;

export type CatalystCategory = (typeof CATALYST_CATEGORIES)[number];

export type EventType =
  | "COMPANY"
  | "SECTOR"
  | "MACRO"
  | "ANALYST"
  | "REGULATORY"
  | "UNKNOWN";

/** Keyword heuristics for category classification (deterministic, not LLM). */
const CATEGORY_RULES: Array<{ category: CatalystCategory; patterns: RegExp[] }> = [
  { category: "EARNINGS", patterns: [/\bearnings?\b/i, /\beps\b/i, /\bquarterly results?\b/i] },
  { category: "GUIDANCE", patterns: [/\bguidance\b/i, /\braises? outlook\b/i, /\blower(s|ed)? outlook\b/i] },
  { category: "ANALYST_UPGRADE", patterns: [/\bupgrad(e|es|ed)\b/i, /\boverweight\b/i, /\bbuy rating\b/i] },
  { category: "ANALYST_DOWNGRADE", patterns: [/\bdowngrad(e|es|ed)\b/i, /\bunderweight\b/i, /\bsell rating\b/i] },
  { category: "PRICE_TARGET_CHANGE", patterns: [/\bprice target\b/i, /\bpt (raised|cut|lifted)\b/i] },
  { category: "FORM_8K", patterns: [/\b8-?k\b/i] },
  { category: "FORM_10Q", patterns: [/\b10-?q\b/i] },
  { category: "FORM_10K", patterns: [/\b10-?k\b/i] },
  { category: "SEC_FILING", patterns: [/\bsec filing\b/i, /\bform\s+\d/i] },
  { category: "MA", patterns: [/\bacqui(re|res|red|sition)\b/i, /\bmerger\b/i, /\btakeover\b/i] },
  { category: "FDA", patterns: [/\bfda\b/i, /\bapproval\b/i, /\bphase [123]\b/i] },
  { category: "REGULATORY", patterns: [/\bregulator(y|ies)?\b/i, /\bantitrust\b/i] },
  { category: "LAWSUIT", patterns: [/\blawsuit\b/i, /\blitigation\b/i, /\bsued\b/i] },
  { category: "GOVERNMENT_CONTRACT", patterns: [/\bgovernment contract\b/i, /\bawarded.*contract\b/i] },
  { category: "PRODUCT_ANNOUNCEMENT", patterns: [/\blaunch(es|ed)?\b/i, /\bunveil(s|ed)?\b/i, /\bproduct\b/i] },
  { category: "PARTNERSHIP", patterns: [/\bpartnership\b/i, /\bcollaborat(e|ion)\b/i] },
  { category: "MANAGEMENT_CHANGE", patterns: [/\bceo\b/i, /\bcfo\b/i, /\bresign(s|ed)?\b/i, /\bappoint(s|ed)?\b/i] },
  { category: "SHARE_OFFERING", patterns: [/\boffering\b/i, /\bdilution\b/i, /\bsecondary\b/i] },
  { category: "BUYBACK", patterns: [/\bbuyback\b/i, /\brepurchase\b/i] },
  { category: "DIVIDEND", patterns: [/\bdividend\b/i] },
  { category: "STOCK_SPLIT", patterns: [/\bstock split\b/i, /\bsplit\b/i] },
  { category: "INSIDER_ACTIVITY", patterns: [/\binsider\b/i, /\bform 4\b/i] },
  { category: "FED", patterns: [/\bfed\b/i, /\bfomc\b/i, /\bfederal reserve\b/i] },
  { category: "CPI", patterns: [/\bcpi\b/i, /\bconsumer price\b/i] },
  { category: "PPI", patterns: [/\bppi\b/i, /\bproducer price\b/i] },
  { category: "JOBS", patterns: [/\bnonfarm\b/i, /\bpayroll\b/i, /\bunemployment\b/i, /\bjobs report\b/i] },
  { category: "RATE_DECISION", patterns: [/\brate (cut|hike|decision|hold)\b/i, /\binterest rate\b/i] },
  { category: "GEOPOLITICAL", patterns: [/\bsanction\b/i, /\bwar\b/i, /\bgeopolitic/i] },
  { category: "MACRO", patterns: [/\bmacro\b/i, /\binflation\b/i, /\bgdp\b/i] },
];

export function classifyCategory(headline: string, summary?: string): CatalystCategory {
  const text = `${headline} ${summary ?? ""}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return rule.category;
    }
  }
  return "OTHER";
}

export function categoryToEventType(category: CatalystCategory): EventType {
  switch (category) {
    case "ANALYST_UPGRADE":
    case "ANALYST_DOWNGRADE":
    case "PRICE_TARGET_CHANGE":
      return "ANALYST";
    case "FDA":
    case "REGULATORY":
    case "LAWSUIT":
    case "SEC_FILING":
    case "FORM_8K":
    case "FORM_10Q":
    case "FORM_10K":
      return "REGULATORY";
    case "MACRO":
    case "FED":
    case "CPI":
    case "PPI":
    case "JOBS":
    case "RATE_DECISION":
    case "GEOPOLITICAL":
      return "MACRO";
    case "SECTOR_NEWS":
      return "SECTOR";
    default:
      return "COMPANY";
  }
}
