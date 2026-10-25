import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Logical,
  type Time,
  type TickMarkType,
} from "lightweight-charts";
import { Maximize2, Minimize2, Radio, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartBar } from "../../lib/api";
import { fmtPrice } from "../../lib/format";
import {
  chartEtLocalization,
  formatEtChartTick,
  formatLastBarEtLabel,
} from "../../lib/chartEtTime";
import { CHART_TIMEFRAMES } from "../../lib/chartTimeframes";
import { studiesFromBars } from "../../lib/chartStudies";
import {
  DEFAULT_CHART_OVERLAYS,
  readJson,
  STORAGE_KEYS,
  writeJson,
  type ChartOverlayPrefs,
} from "../../lib/storage";
import {
  clampVisibleLogicalRange,
  DEFAULT_BAR_SPACING,
  liveVisibleLogicalRange,
  RIGHT_OFFSET_BARS,
} from "../../lib/chartViewport";
import { SessionShadePrimitive, sessionBands } from "./sessionShade";

/** Display-only styling — calculations unchanged in chartStudies. */
const STUDY_LINE = {
  vwap: { color: "rgba(96, 165, 250, 0.82)", lineWidth: 2 as const },
  ema: { color: "rgba(251, 191, 36, 0.78)", lineWidth: 2 as const },
  bb: { color: "rgba(34, 211, 238, 0.55)", lineWidth: 1 as const },
  rsi: { color: "rgba(192, 132, 252, 0.92)", lineWidth: 2 as const },
};

const OVERLAY_TOGGLES = [
  { id: "vwap" as const, label: "VWAP", className: "vwap" },
  { id: "ema" as const, label: "EMA 9", className: "ema9" },
  { id: "bb" as const, label: "BB 20", className: "bb" },
  { id: "rsi" as const, label: "RSI 14", className: "rsi" },
];

function safeSetVisibleLogicalRange(
  chart: IChartApi,
  from: number,
  to: number,
  barCount: number,
): void {
  const range = clampVisibleLogicalRange(from, to, barCount);
  if (!range) return;
  try {
    chart.timeScale().setVisibleLogicalRange(range);
  } catch {
    /* pinch/resize race on mobile Safari */
  }
}

export function CandleChart(props: {
  bars: ChartBar[] | null;
  loading: boolean;
  error: string | null;
  timeframe: string;
  onTimeframe: (tf: string) => void;
  symbol: string;
  extendedHours?: boolean;
  onExtendedHours?: (on: boolean) => void;
  labTestDataMode?: boolean;
  labTestDataAvailable?: boolean;
  onLabTestDataMode?: (on: boolean) => void;
  mockTradingMode?: boolean;
  onMockTradingMode?: (on: boolean) => void;
  lastPrice?: number | null;
  onRetry?: () => void;
  chartExtras?: {
    rvol: number | null;
    feedLabel: string;
    quoteNote: string | null;
    side?: "LONG" | "SHORT";
    onSide?: (side: "LONG" | "SHORT") => void;
  };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rsiHostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rangeSyncRef = useRef(false);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiLinesRef = useRef<IPriceLine[]>([]);
  const shadeRef = useRef<SessionShadePrimitive | null>(null);
  const fitKeyRef = useRef<string>("");
  const structureKeyRef = useRef<string>("");
  const followLiveRef = useRef(true);
  const clampRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [followLive, setFollowLive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlays, setOverlays] = useState<ChartOverlayPrefs>(() =>
    readJson(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAYS),
  );

  const toggleOverlay = useCallback((key: keyof ChartOverlayPrefs) => {
    setOverlays((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeJson(STORAGE_KEYS.chartOverlays, next);
      return next;
    });
  }, []);

  const applyOverlayVisibility = useCallback((prefs: ChartOverlayPrefs) => {
    vwapRef.current?.applyOptions({ visible: prefs.vwap });
    emaRef.current?.applyOptions({ visible: prefs.ema });
    const bbOn = prefs.bb;
    bbUpperRef.current?.applyOptions({ visible: bbOn });
    bbMidRef.current?.applyOptions({ visible: bbOn });
    bbLowerRef.current?.applyOptions({ visible: bbOn });
  }, []);

  const syncRsiTimeRange = useCallback((from: number, to: number, barCount: number) => {
    if (!overlaysRef.current.rsi || !rsiChartRef.current || rangeSyncRef.current) return;
    rangeSyncRef.current = true;
    try {
      safeSetVisibleLogicalRange(rsiChartRef.current, from, to, barCount);
    } finally {
      rangeSyncRef.current = false;
    }
  }, []);

  const applyLiveViewport = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const count = series.data().length;
    if (count <= 0) return;
    const live = liveVisibleLogicalRange(count);
    if (!live) return;
    chart.timeScale().applyOptions({ rightOffset: RIGHT_OFFSET_BARS });
    safeSetVisibleLogicalRange(chart, live.from, live.to, count);
    syncRsiTimeRange(live.from, live.to, count);
  }, [syncRsiTimeRange]);

  const goLive = useCallback(() => {
    followLiveRef.current = true;
    setFollowLive(true);
    const chart = chartRef.current;
    if (chart) {
      chart.applyOptions({
        timeScale: {
          barSpacing: DEFAULT_BAR_SPACING,
          rightOffset: RIGHT_OFFSET_BARS,
          shiftVisibleRangeOnNewBar: true,
        },
      });
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
    applyLiveViewport();
    requestAnimationFrame(() => {
      applyLiveViewport();
      try {
        chartRef.current?.timeScale().scrollToRealTime();
        rsiChartRef.current?.timeScale().scrollToRealTime();
      } catch {
        /* no data yet */
      }
    });
  }, [applyLiveViewport]);

  useEffect(() => {
    const showRsiPanel = overlays.rsi;
    chartRef.current?.applyOptions({
      timeScale: { timeVisible: !showRsiPanel, secondsVisible: false },
    });
    rsiChartRef.current?.applyOptions({
      timeScale: { timeVisible: showRsiPanel, secondsVisible: false },
    });
    requestAnimationFrame(() => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: hostRef.current.clientWidth,
          height: hostRef.current.clientHeight,
        });
      }
      if (showRsiPanel && rsiHostRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiHostRef.current.clientWidth,
          height: rsiHostRef.current.clientHeight,
        });
        const count = seriesRef.current?.data()?.length ?? 0;
        const range = chartRef.current?.timeScale().getVisibleLogicalRange();
        if (range && count > 0) {
          syncRsiTimeRange(Number(range.from), Number(range.to), count);
        }
      }
    });
  }, [overlays.rsi, syncRsiTimeRange]);

  useEffect(() => {
    const onFs = () => {
      setFullscreen(document.fullscreenElement === wrapRef.current);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* iOS / unsupported */
    }
  }, []);

  useEffect(() => {
    followLiveRef.current = true;
    setFollowLive(true);
    fitKeyRef.current = "";
    structureKeyRef.current = "";
  }, [props.symbol, props.timeframe]);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      height: hostRef.current.clientHeight || 520,
      layout: {
        background: { type: ColorType.Solid, color: "#080D14" },
        textColor: "#9AA8BA",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: (hostRef.current?.clientWidth ?? 999) < 768 ? 13 : 12,
      },
      grid: {
        vertLines: { color: "#15202c" },
        horzLines: { color: "#15202c" },
      },
      rightPriceScale: { borderColor: "#2a3a4d", scaleMargins: { top: 0.06, bottom: 0.28 } },
      localization: chartEtLocalization,
      timeScale: {
        borderColor: "#2a3a4d",
        timeVisible: !readJson(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAYS).rsi,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatEtChartTick(time, tickMarkType),
        rightOffset: RIGHT_OFFSET_BARS,
        fixRightEdge: true,
        fixLeftEdge: true,
        shiftVisibleRangeOnNewBar: true,
        barSpacing: 7,
        minBarSpacing: 2,
      },
      crosshair: { mode: 1 },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#35C89A",
      downColor: "#F87171",
      borderUpColor: "#35C89A",
      borderDownColor: "#F87171",
      wickUpColor: "#35C89A",
      wickDownColor: "#F87171",
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.62, bottom: 0.2 },
      borderVisible: false,
    });
    const lineCommon = {
      priceLineVisible: false as const,
      lastValueVisible: false as const,
      crosshairMarkerVisible: false as const,
    };
    const vwap = chart.addSeries(LineSeries, {
      ...lineCommon,
      color: STUDY_LINE.vwap.color,
      lineWidth: STUDY_LINE.vwap.lineWidth,
    });
    const ema = chart.addSeries(LineSeries, {
      ...lineCommon,
      color: STUDY_LINE.ema.color,
      lineWidth: STUDY_LINE.ema.lineWidth,
    });
    const bbUpper = chart.addSeries(LineSeries, {
      ...lineCommon,
      color: STUDY_LINE.bb.color,
      lineWidth: STUDY_LINE.bb.lineWidth,
      lineStyle: LineStyle.Dashed,
    });
    const bbMid = chart.addSeries(LineSeries, {
      ...lineCommon,
      color: "rgba(34, 211, 238, 0.35)",
      lineWidth: 1,
    });
    const bbLower = chart.addSeries(LineSeries, {
      ...lineCommon,
      color: STUDY_LINE.bb.color,
      lineWidth: STUDY_LINE.bb.lineWidth,
      lineStyle: LineStyle.Dashed,
    });
    const shade = new SessionShadePrimitive();
    series.attachPrimitive(shade);
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    vwapRef.current = vwap;
    emaRef.current = ema;
    bbUpperRef.current = bbUpper;
    bbMidRef.current = bbMid;
    bbLowerRef.current = bbLower;
    shadeRef.current = shade;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(hostRef.current);

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || clampRef.current) return;
      const count = seriesRef.current?.data()?.length ?? 0;
      if (count <= 0) return;
      const maxTo = count - 1 + RIGHT_OFFSET_BARS;
      let from = Number(range.from);
      let to = Number(range.to);
      const clamped = clampVisibleLogicalRange(from, to, count);
      if (!clamped) return;
      const changed = clamped.from !== from || clamped.to !== to;
      from = clamped.from as number;
      to = clamped.to as number;
      const atLiveEdge = to >= maxTo - 0.5 || to >= count - 1.5;
      if (!atLiveEdge && followLiveRef.current) {
        followLiveRef.current = false;
        setFollowLive(false);
      }
      if (changed) {
        clampRef.current = true;
        safeSetVisibleLogicalRange(chart, from, to, count);
        clampRef.current = false;
      }
      if (overlaysRef.current.rsi && rsiChartRef.current && !rangeSyncRef.current) {
        rangeSyncRef.current = true;
        try {
          safeSetVisibleLogicalRange(rsiChartRef.current, from, to, count);
        } finally {
          rangeSyncRef.current = false;
        }
      }
    });

    const mobileMq = window.matchMedia("(max-width: 767px)");
    const applyVolumeLayout = () => {
      const hideVolume = mobileMq.matches;
      volume.applyOptions({ visible: !hideVolume });
      chart.priceScale("vol").applyOptions({ visible: !hideVolume });
      chart.priceScale("right").applyOptions({
        scaleMargins: { top: 0.06, bottom: hideVolume ? 0.08 : 0.28 },
      });
    };
    applyVolumeLayout();
    mobileMq.addEventListener("change", applyVolumeLayout);

    return () => {
      mobileMq.removeEventListener("change", applyVolumeLayout);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      vwapRef.current = null;
      emaRef.current = null;
      bbUpperRef.current = null;
      bbMidRef.current = null;
      bbLowerRef.current = null;
      shadeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!rsiHostRef.current) return;
    const el = rsiHostRef.current;
    const chart = createChart(el, {
      height: el.clientHeight || 88,
      layout: {
        background: { type: ColorType.Solid, color: "#080D14" },
        textColor: "#9AA8BA",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: (el.clientWidth ?? 999) < 768 ? 16 : 14,
      },
      grid: {
        vertLines: { color: "#15202c" },
        horzLines: { color: "#1a2533" },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        borderColor: "#2a3a4d",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        alignLabels: false,
        textColor: "transparent",
      },
      localization: chartEtLocalization,
      timeScale: {
        borderColor: "#2a3a4d",
        timeVisible: readJson(STORAGE_KEYS.chartOverlays, DEFAULT_CHART_OVERLAYS).rsi,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatEtChartTick(time, tickMarkType),
        rightOffset: RIGHT_OFFSET_BARS,
        fixRightEdge: true,
        fixLeftEdge: true,
        shiftVisibleRangeOnNewBar: true,
        barSpacing: 7,
        minBarSpacing: 2,
      },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });
    const rsi = chart.addSeries(LineSeries, {
      color: STUDY_LINE.rsi.color,
      lineWidth: STUDY_LINE.rsi.lineWidth,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    rsiLinesRef.current = [
      rsi.createPriceLine({
        price: 100,
        color: "transparent",
        lineWidth: 1,
        lineVisible: false,
        axisLabelVisible: false,
      }),
      rsi.createPriceLine({
        price: 70,
        color: "#f87171",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
        axisLabelColor: "#f87171",
        axisLabelTextColor: "#1a0a0a",
      }),
      rsi.createPriceLine({
        price: 50,
        color: "#cbd5e1",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
        axisLabelColor: "#cbd5e1",
        axisLabelTextColor: "#111820",
      }),
      rsi.createPriceLine({
        price: 30,
        color: "#35c89a",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "",
        axisLabelColor: "#35c89a",
        axisLabelTextColor: "#042016",
      }),
      rsi.createPriceLine({
        price: 0,
        color: "transparent",
        lineWidth: 1,
        lineVisible: false,
        axisLabelVisible: false,
      }),
    ];
    chart.priceScale("right").applyOptions({ autoScale: true });
    rsiChartRef.current = chart;
    rsiRef.current = rsi;

    const ro = new ResizeObserver(() => {
      if (!rsiHostRef.current || !rsiChartRef.current) return;
      rsiChartRef.current.applyOptions({
        width: rsiHostRef.current.clientWidth,
        height: rsiHostRef.current.clientHeight,
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      for (const ln of rsiLinesRef.current) {
        try {
          rsi.removePriceLine(ln);
        } catch {
          /* removed */
        }
      }
      rsiLinesRef.current = [];
      chart.remove();
      rsiChartRef.current = null;
      rsiRef.current = null;
    };
  }, []);

  const applyStudyLines = useCallback((aligned: ChartBar[]) => {
    const { ema9, bb, rsi14 } = studiesFromBars(aligned);
    const toLine = (values: (number | null)[]): LineData<Time>[] =>
      aligned.flatMap((b, i) => {
        const v = values[i];
        return v != null && Number.isFinite(v) ? [{ time: b.time as Time, value: v }] : [];
      });
    emaRef.current?.setData(toLine(ema9));
    bbUpperRef.current?.setData(toLine(bb.upper));
    bbMidRef.current?.setData(toLine(bb.mid));
    bbLowerRef.current?.setData(toLine(bb.lower));
    rsiRef.current?.setData(toLine(rsi14));
  }, []);

  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  useEffect(() => {
    const series = seriesRef.current;
    const volume = volumeRef.current;
    const vwap = vwapRef.current;
    if (!series || !volume || !vwap) return;

    if (!props.bars?.length) {
      structureKeyRef.current = "";
      fitKeyRef.current = "";
      series.setData([]);
      volume.setData([]);
      vwap.setData([]);
      emaRef.current?.setData([]);
      bbUpperRef.current?.setData([]);
      bbMidRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
      rsiRef.current?.setData([]);
      shadeRef.current?.setBands([]);
      return;
    }

    const aligned = props.bars.filter(
      (b) => b != null && Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && Number.isFinite(b.close),
    );
    const structureKey = `${props.symbol}|${props.timeframe}|${aligned.length}|${aligned[0]?.time}|${aligned.at(-1)?.time}`;
    const canPatchLast = structureKeyRef.current === structureKey && structureKey.length > 0;

    if (canPatchLast) {
      const last = aligned.at(-1)!;
      const t = last.time as Time;
      series.update({
        time: t,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volume.update({
        time: t,
        value: last.volume ?? 0,
        color: last.close >= last.open ? "rgba(53,200,154,0.35)" : "rgba(248,113,113,0.35)",
      });
      if (last.vwap != null && Number.isFinite(last.vwap)) {
        vwap.update({ time: t, value: last.vwap });
      }
      applyStudyLines(aligned);
      applyOverlayVisibility(overlaysRef.current);
      if (followLiveRef.current) {
        requestAnimationFrame(() => applyLiveViewport());
      }
    } else {
      structureKeyRef.current = structureKey;

      const candles: CandlestickData<Time>[] = aligned.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));
      series.setData(candles);

      const vols: HistogramData<Time>[] = aligned.map((b) => ({
        time: b.time as Time,
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(53,200,154,0.35)" : "rgba(248,113,113,0.35)",
      }));
      volume.setData(vols);

      const vwapPts: LineData<Time>[] = aligned
        .filter((b) => b.vwap != null && Number.isFinite(b.vwap))
        .map((b) => ({ time: b.time as Time, value: b.vwap as number }));
      vwap.setData(vwapPts);
      applyStudyLines(aligned);
      applyOverlayVisibility(overlaysRef.current);
      shadeRef.current?.setBands(sessionBands(aligned, props.timeframe, props.extendedHours === true));

      chartRef.current?.applyOptions({
        localization: chartEtLocalization,
        timeScale: {
          tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
            formatEtChartTick(time, tickMarkType),
        },
      });

      const fitKey = `${props.symbol}|${props.timeframe}|${aligned[0]?.time}|${aligned.at(-1)?.time}|${aligned.length}`;
      if (fitKeyRef.current !== fitKey) {
        fitKeyRef.current = fitKey;
        if (followLiveRef.current) {
          requestAnimationFrame(() => goLive());
        }
      }
    }
  }, [
    props.bars,
    props.symbol,
    props.timeframe,
    props.extendedHours,
    goLive,
    applyLiveViewport,
    applyStudyLines,
    applyOverlayVisibility,
  ]);

  useEffect(() => {
    applyOverlayVisibility(overlays);
    rsiRef.current?.applyOptions({ visible: overlays.rsi });
  }, [overlays, applyOverlayVisibility]);

  const lastRsi = useMemo(() => {
    if (!props.bars?.length) return null;
    const { rsi14 } = studiesFromBars(props.bars);
    for (let i = rsi14.length - 1; i >= 0; i--) {
      const v = rsi14[i];
      if (v != null && Number.isFinite(v)) return v;
    }
    return null;
  }, [props.bars]);

  const lastBarEt =
    props.bars?.length && props.bars.at(-1)?.time
      ? formatLastBarEtLabel(props.bars.at(-1)!.time)
      : null;

  return (
    <div
      ref={wrapRef}
      className={`panel chart-wrap chart-wrap-hero${fullscreen ? " chart-fullscreen" : ""}`}
    >
      <div className="chart-toolbar">
        <div className="chart-toolbar-row chart-toolbar-tf">
          <div className="tf-group" role="group" aria-label="Chart timeframe">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                className={props.timeframe === tf.id ? "active" : ""}
                aria-pressed={props.timeframe === tf.id}
                onClick={() => props.onTimeframe(tf.id)}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-toolbar-row chart-toolbar-indicators">
          <span className="chart-indicators-label">Chart lines</span>
          <div className="chart-indicators-row">
            <div className="chart-overlay-toggles" role="group" aria-label="Chart line overlays">
              {OVERLAY_TOGGLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`leg-toggle ${item.className}${overlays[item.id] ? " on" : ""}`}
                  aria-pressed={overlays[item.id]}
                  aria-label={`${overlays[item.id] ? "Hide" : "Show"} ${item.label}`}
                  onClick={() => toggleOverlay(item.id)}
                >
                  {item.label}
                </button>
              ))}
              {props.lastPrice != null ? (
                <span className="leg last-px chart-last-px">Last {fmtPrice(props.lastPrice)}</span>
              ) : null}
            </div>
            <button
              type="button"
              className="chart-settings-btn show-mobile-only"
              aria-label="Chart settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="chart-toolbar-row chart-toolbar-right">
          <button
            type="button"
            className={`chart-action-btn${props.extendedHours ? " active" : ""}`}
            title="Off: 9:30 AM–4:00 PM ET only. On: premarket and after-hours are shown in blue and are not the regular-session close."
            onClick={() => props.onExtendedHours?.(!props.extendedHours)}
          >
            Extended {props.extendedHours ? "ON" : "OFF"}
          </button>
          <div className="chart-actions" role="group" aria-label="Chart view">
            <button
              type="button"
              className={`chart-action-btn chart-live-btn${followLive ? " active" : " needs-live"}`}
              title="Reset zoom and jump to the latest candles"
              onClick={() => goLive()}
            >
              <Radio size={16} aria-hidden />
              <span className="chart-live-label-long">Return to Live</span>
              <span className="chart-live-label-short">Live</span>
            </button>
            <button
              type="button"
              className="chart-action-btn"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen chart"}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
              {fullscreen ? "Exit" : "Full"}
            </button>
          </div>
          <span
            className="badge muted-axis"
            title={
              props.extendedHours
                ? "Blue bands are premarket and after-hours. Regular session is still 09:30–16:00 ET."
                : "Regular session only, 09:30–16:00 US Eastern."
            }
          >
            {props.extendedHours ? "EXT · ET" : "RTH · ET"}
            {lastBarEt ? ` · last ${lastBarEt}` : ""}
          </span>
        </div>
      </div>
      {settingsOpen ? (
        <div className="chart-settings-sheet" role="dialog" aria-label="Chart settings">
          <div className="chart-settings-head">
            <strong>Chart settings</strong>
            <button type="button" className="chart-action-btn" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          {props.chartExtras?.onSide ? (
            <div className="side-toggle" role="group" aria-label="Direction">
              <button
                type="button"
                className={`buy ${props.chartExtras.side === "LONG" ? "active" : ""}`}
                onClick={() => props.chartExtras?.onSide?.("LONG")}
              >
                LONG
              </button>
              <button
                type="button"
                className={`sell ${props.chartExtras.side === "SHORT" ? "active" : ""}`}
                onClick={() => props.chartExtras?.onSide?.("SHORT")}
              >
                SHORT
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`chart-action-btn${props.extendedHours ? " active" : ""}`}
            onClick={() => props.onExtendedHours?.(!props.extendedHours)}
          >
            Extended hours {props.extendedHours ? "ON" : "OFF"}
          </button>
          {props.labTestDataAvailable ? (
            <button
              type="button"
              className={`chart-action-btn${props.labTestDataMode ? " active" : ""}`}
              onClick={() => props.onLabTestDataMode?.(!props.labTestDataMode)}
            >
              Lab test data {props.labTestDataMode ? "ON" : "OFF"}
            </button>
          ) : null}
          {props.onMockTradingMode ? (
            <button
              type="button"
              className={`chart-action-btn${props.mockTradingMode ? " active" : ""}`}
              onClick={() => props.onMockTradingMode?.(!props.mockTradingMode)}
            >
              Mock trading {props.mockTradingMode ? "ON" : "OFF"}
            </button>
          ) : null}
          <button type="button" className="chart-action-btn" onClick={() => goLive()}>
            Return to Live
          </button>
          <button type="button" className="chart-action-btn" onClick={() => void toggleFullscreen()}>
            {fullscreen ? "Exit fullscreen" : "Fullscreen chart"}
          </button>
          <p className="chart-settings-meta">
            {props.extendedHours ? "EXT · ET" : "RTH · ET"}
            {lastBarEt ? ` · last ${lastBarEt}` : ""}
            {props.chartExtras?.feedLabel ? ` · ${props.chartExtras.feedLabel}` : ""}
            {props.chartExtras?.rvol != null ? ` · RVOL ${props.chartExtras.rvol.toFixed(2)}x` : ""}
          </p>
          {props.chartExtras?.quoteNote ? (
            <p className="chart-settings-meta">{props.chartExtras.quoteNote}</p>
          ) : null}
        </div>
      ) : null}
      <div className="chart-stack">
        <div className="chart-host" ref={hostRef}>
          {props.error && (
            <div className="chart-overlay-msg chart-overlay-warn" role="alert">
              <div>
                <p style={{ margin: "0 0 0.6rem" }}>{props.error}</p>
                {props.onRetry && (
                  <button type="button" className="chart-action-btn" onClick={props.onRetry}>
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
          {props.loading && !props.error && (!props.bars || props.bars.length === 0) && (
            <div className="chart-overlay-msg">Loading {props.symbol}…</div>
          )}
          {!props.loading && !props.error && (!props.bars || props.bars.length === 0) && (
            <div className="chart-overlay-msg">
              No bar data for {props.symbol} / {props.timeframe}.
            </div>
          )}
        </div>
        <div
          className={`chart-rsi-panel${overlays.rsi ? "" : " chart-rsi-panel--hidden"}`}
          aria-hidden={!overlays.rsi}
        >
          <div className="chart-rsi-head">
            <span className="chart-rsi-title">RSI (14)</span>
            {lastRsi != null ? (
              <span className="chart-rsi-val">{lastRsi.toFixed(1)}</span>
            ) : (
              <span className="chart-rsi-val muted">—</span>
            )}
          </div>
          <div className="chart-rsi-host" ref={rsiHostRef} />
        </div>
      </div>
    </div>
  );
}
