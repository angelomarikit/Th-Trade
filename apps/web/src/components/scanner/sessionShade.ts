import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export interface SessionBand {
  from: number;
  to: number;
  alt: boolean;
  extended: boolean;
}

/** Alternate session bands so each trading day reads as its own block. */
export function sessionBands(
  bars: { time: number }[],
  timeframe: string,
  extendedHours = false,
): SessionBand[] {
  if (bars.length === 0) return [];
  const daily = timeframe.toLowerCase() === "1d";
  if (daily || !extendedHours) {
    if (daily) {
      return bars.map((b, i) => ({
        from: b.time,
        to: bars[i + 1]?.time ?? b.time,
        alt: i % 2 === 1,
        extended: false,
      }));
    }
    const groups: { from: number; to: number }[] = [];
    let key = "";
    for (const b of bars) {
      const day = etDayKey(b.time);
      if (day !== key) {
        groups.push({ from: b.time, to: b.time });
        key = day;
      } else {
        groups[groups.length - 1]!.to = b.time;
      }
    }
    return groups.map((g, i) => ({ ...g, alt: i % 2 === 1, extended: false }));
  }

  const groups: { from: number; to: number; extended: boolean; day: string }[] = [];
  let key = "";
  for (const b of bars) {
    const day = etDayKey(b.time);
    const extended = !isRthMinute(b.time);
    const nextKey = `${day}|${extended ? "x" : "r"}`;
    if (nextKey !== key) {
      groups.push({ from: b.time, to: b.time, extended, day });
      key = nextKey;
    } else {
      groups[groups.length - 1]!.to = b.time;
    }
  }
  let rthIndex = 0;
  return groups.map((g) => {
    const alt = g.extended ? false : rthIndex++ % 2 === 1;
    return { from: g.from, to: g.to, alt, extended: g.extended };
  });
}

function isRthMinute(unixSeconds: number): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(new Date(unixSeconds * 1000)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const mins = hour * 60 + Number(bag.minute);
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

function etDayKey(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

class SessionShadeRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly primitive: SessionShadePrimitive) {}

  draw(): void {}

  drawBackground(target: Parameters<NonNullable<IPrimitivePaneRenderer["drawBackground"]>>[0]): void {
    const chart = this.primitive.chartApi();
    const bands = this.primitive.bands();
    if (!chart || bands.length === 0) return;
    const timeScale = chart.timeScale();
    const barSpacing = timeScale.options().barSpacing;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const height = scope.bitmapSize.height;
      const ratio = scope.horizontalPixelRatio;
      for (const band of bands) {
        const x1 = timeScale.timeToCoordinate(band.from as Time);
        const x2 = timeScale.timeToCoordinate(band.to as Time);
        if (x1 == null) continue;
        const left = x1;
        const right = (x2 ?? x1) + barSpacing;
        const x = Math.round(Math.min(left, right) * ratio);
        const w = Math.max(1, Math.round(Math.abs(right - left) * ratio));
        ctx.fillStyle = band.extended
          ? "rgba(96, 165, 250, 0.10)"
          : band.alt
            ? "rgba(226, 232, 240, 0.055)"
            : "rgba(0, 0, 0, 0.22)";
        ctx.fillRect(x, 0, w, height);
      }
    });
  }
}

class SessionShadePaneView implements IPrimitivePaneView {
  private readonly rendererInstance: SessionShadeRenderer;
  constructor(primitive: SessionShadePrimitive) {
    this.rendererInstance = new SessionShadeRenderer(primitive);
  }
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return this.rendererInstance;
  }
}

export class SessionShadePrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _bands: SessionBand[] = [];
  private readonly _view: SessionShadePaneView;
  private readonly _views: readonly IPrimitivePaneView[];

  constructor() {
    this._view = new SessionShadePaneView(this);
    this._views = [this._view];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._requestUpdate = null;
  }

  chartApi(): IChartApi | null {
    return this._chart;
  }

  bands(): readonly SessionBand[] {
    return this._bands;
  }

  setBands(bands: SessionBand[]): void {
    this._bands = bands;
    this._requestUpdate?.();
  }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}
