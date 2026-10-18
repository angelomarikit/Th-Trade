export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export const STORAGE_KEYS = {
  sidebarCollapsed: "wulu.v2.sidebarCollapsed",
  bottomDockOpen: "wulu.v2.bottomDockOpen",
  watchlist: "wulu.v2.watchlist",
  notes: "wulu.v2.notes",
  alerts: "wulu.v2.alerts",
  recentScans: "wulu.v2.recentScans",
  inspectorOpen: "wulu.v2.inspectorOpen",
  chartOverlays: "wulu.v2.chartOverlays",
} as const;

export type ChartOverlayPrefs = {
  vwap: boolean;
  ema: boolean;
  bb: boolean;
  rsi: boolean;
};

export const DEFAULT_CHART_OVERLAYS: ChartOverlayPrefs = {
  vwap: true,
  ema: true,
  bb: true,
  rsi: true,
};
