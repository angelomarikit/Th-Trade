import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { ChartBar } from "../../lib/api";

export interface LevelOverlay {
  trigger: number;
  zoneLow: number;
  zoneHigh: number;
  stop: number;
  t1: number;
  t2: number;
}

const TFS = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1D", label: "1D" },
] as const;

export function CandleChart(props: {
  bars: ChartBar[] | null;
  loading: boolean;
  error: string | null;
  timeframe: string;
  onTimeframe: (tf: string) => void;
  levels: LevelOverlay | null;
  symbol: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const fitOnce = useRef<string>("");

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      height: hostRef.current.clientHeight || 520,
      layout: {
        background: { type: ColorType.Solid, color: "#080D14" },
        textColor: "#8C9BAE",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#182433" },
        horzLines: { color: "#182433" },
      },
      rightPriceScale: { borderColor: "#263446" },
      timeScale: { borderColor: "#263446", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#35C89A",
      downColor: "#F87171",
      borderUpColor: "#35C89A",
      borderDownColor: "#F87171",
      wickUpColor: "#35C89A",
      wickDownColor: "#F87171",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(hostRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of linesRef.current) {
      series.removePriceLine(line);
    }
    linesRef.current = [];

    if (!props.bars?.length) {
      series.setData([]);
      return;
    }

    const data: CandlestickData<Time>[] = props.bars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    series.setData(data);

    const key = `${props.symbol}:${props.timeframe}:${props.bars.length}:${props.bars[0]?.time}`;
    if (fitOnce.current !== key) {
      chartRef.current?.timeScale().fitContent();
      fitOnce.current = key;
    }

    if (props.levels) {
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
      linesRef.current = [
        mk(L.trigger, "#60A5FA", "TRIG"),
        mk(L.zoneLow, "#2DD4BF", "ZONE LO"),
        mk(L.zoneHigh, "#2DD4BF", "ZONE HI"),
        mk(L.stop, "#F87171", "STOP"),
        mk(L.t1, "#60A5FA", "T1"),
        mk(L.t2, "#A78BFA", "T2"),
      ];
    }
  }, [props.bars, props.levels, props.symbol, props.timeframe]);

  return (
    <div className="panel chart-wrap">
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
        <span className="badge" title="Setup levels are indicative — not broker orders">
          LEVELS = SETUP (NOT ORDERS)
        </span>
      </div>
      <div className="chart-host" ref={hostRef}>
        {props.loading && <div className="chart-overlay-msg">Loading bars…</div>}
        {!props.loading && props.error && (
          <div className="chart-overlay-msg">Chart feed error: {props.error}</div>
        )}
        {!props.loading && !props.error && (!props.bars || props.bars.length === 0) && (
          <div className="chart-overlay-msg">No bar data for this symbol/timeframe.</div>
        )}
      </div>
    </div>
  );
}
