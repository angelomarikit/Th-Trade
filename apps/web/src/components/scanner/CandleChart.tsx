import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type TickMarkType,
} from "lightweight-charts";
import { Maximize2, Minimize2, Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartBar } from "../../lib/api";
import {
  chartEtLocalization,
  formatEtChartTick,
  formatLastBarEtLabel,
} from "../../lib/chartEtTime";

export interface LevelOverlay {
  trigger: number;
  zoneLow: number;
  zoneHigh: number;
  stop: number;
  t1: number;
  t2: number;
  /** When set, overlays only apply if this matches the chart symbol. */
  forSymbol?: string;
}

const TFS = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1D", label: "1D" },
] as const;

/** Empty “future” space to the right of the last candle (in bars). */
const DEFAULT_RIGHT_OFFSET = 18;

export function CandleChart(props: {
  bars: ChartBar[] | null;
  loading: boolean;
  error: string | null;
  timeframe: string;
  onTimeframe: (tf: string) => void;
  levels: LevelOverlay | null;
  symbol: string;
  /** Live setup quote — patches the last candle so chart matches header price. */
  lastPrice?: number | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const fitKeyRef = useRef<string>("");
  const structureKeyRef = useRef<string>("");
  const levelsKeyRef = useRef<string>("");
  const followLiveRef = useRef(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [followLive, setFollowLive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const goLive = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    followLiveRef.current = true;
    setFollowLive(true);
    chart.timeScale().applyOptions({ rightOffset: DEFAULT_RIGHT_OFFSET });
    chart.timeScale().scrollToRealTime();
  }, []);

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
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#15202c" },
        horzLines: { color: "#15202c" },
      },
      rightPriceScale: { borderColor: "#2a3a4d", scaleMargins: { top: 0.08, bottom: 0.22 } },
      localization: chartEtLocalization,
      timeScale: {
        borderColor: "#2a3a4d",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatEtChartTick(time, tickMarkType),
        rightOffset: DEFAULT_RIGHT_OFFSET,
        fixRightEdge: false,
        fixLeftEdge: false,
        shiftVisibleRangeOnNewBar: false,
        barSpacing: 8,
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
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    const vwap = chart.addSeries(LineSeries, {
      color: "#60A5FA",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    vwapRef.current = vwap;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(hostRef.current);

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      const lastIdx = seriesRef.current?.data()?.length ?? 0;
      if (lastIdx <= 0) return;
      const atLiveEdge = range.to >= lastIdx - 1.5;
      if (!atLiveEdge && followLiveRef.current) {
        followLiveRef.current = false;
        setFollowLive(false);
      }
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      vwapRef.current = null;
      linesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const volume = volumeRef.current;
    const vwap = vwapRef.current;
    if (!series || !volume || !vwap) return;

    if (!props.bars?.length) {
      structureKeyRef.current = "";
      levelsKeyRef.current = "";
      fitKeyRef.current = "";
      for (const line of linesRef.current) {
        try {
          series.removePriceLine(line);
        } catch {
          /* cleared */
        }
      }
      linesRef.current = [];
      series.setData([]);
      volume.setData([]);
      vwap.setData([]);
      return;
    }

    const aligned = props.bars.map((b, i) => {
      if (i !== props.bars!.length - 1) return b;
      const px = props.lastPrice;
      if (px == null || !Number.isFinite(px) || px <= 0) return b;
      return {
        ...b,
        close: px,
        high: Math.max(b.high, px),
        low: Math.min(b.low, px),
        completed: false,
      };
    });

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

    const levelsOk =
      props.levels != null &&
      (!props.levels.forSymbol ||
        props.levels.forSymbol.toUpperCase() === props.symbol.toUpperCase());

    const levelsKey =
      levelsOk && props.levels
        ? `${props.levels.trigger}|${props.levels.stop}|${props.levels.t1}|${props.levels.t2}|${props.levels.zoneLow}|${props.levels.zoneHigh}`
        : "";

    if (levelsKey !== levelsKeyRef.current) {
      for (const line of linesRef.current) {
        try {
          series.removePriceLine(line);
        } catch {
          /* cleared */
        }
      }
      linesRef.current = [];
      levelsKeyRef.current = levelsKey;

      if (levelsOk && props.levels) {
        const L = props.levels;
        const mk = (price: number, color: string, title: string) =>
          series.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title,
          });
        const entryMid = (L.zoneLow + L.zoneHigh) / 2;
        linesRef.current = [
          mk(L.trigger, "#93C5FD", "TRIG"),
          mk(entryMid, "#2DD4BF", "ENTRY"),
          mk(L.stop, "#F87171", "STOP"),
          mk(L.t1, "#34D399", "T1"),
          mk(L.t2, "#A78BFA", "T2"),
        ];
      }
    }
  }, [props.bars, props.lastPrice, props.levels, props.symbol, props.timeframe, goLive]);

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
        <div className="tf-group" role="group" aria-label="Chart timeframe">
          {TFS.map((tf) => (
            <button
              key={tf.id}
              type="button"
              className={props.timeframe === tf.id ? "active" : ""}
              onClick={() => props.onTimeframe(tf.id)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="chart-toolbar-right">
          <div className="chart-legend" aria-hidden="true">
            <span className="leg vwap">VWAP</span>
            <span className="leg entry">Entry</span>
            <span className="leg stop">Stop</span>
            <span className="leg t1">T1</span>
            <span className="leg t2">T2</span>
          </div>
          <div className="chart-actions" role="group" aria-label="Chart view">
            <button
              type="button"
              className={`chart-action-btn${followLive ? " active" : ""}`}
              title="Jump to latest candle with space for upcoming bars"
              onClick={() => goLive()}
            >
              <Radio size={14} aria-hidden />
              Live
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
          <span className="badge muted-axis" title="Candle times use US Eastern, same as the top bar clock">
            AXIS · ET{lastBarEt ? ` · last ${lastBarEt}` : ""}
          </span>
          <span className="badge hide-sm" title="Setup levels are indicative — not broker orders">
            LEVELS = SETUP (NOT ORDERS)
          </span>
        </div>
      </div>
      <div className="chart-host" ref={hostRef}>
        {props.error && (
          <div className="chart-overlay-msg chart-overlay-warn" role="alert">
            {props.error}
          </div>
        )}
        {props.loading && !props.error && (!props.bars || props.bars.length === 0) && (
          <div className="chart-overlay-msg">Loading {props.symbol}…</div>
        )}
        {!props.loading && !props.error && (!props.bars || props.bars.length === 0) && (
          <div className="chart-overlay-msg">No bar data for {props.symbol} / {props.timeframe}.</div>
        )}
      </div>
    </div>
  );
}
