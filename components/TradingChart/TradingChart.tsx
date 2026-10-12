"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineType,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import { INTERVALS, toHeikinAshi, type Candle, type Interval } from "../../lib/chart-data";
import styles from "./TradingChart.module.css";

export type ChartType =
  | "candles"
  | "hollow"
  | "bars"
  | "heikin"
  | "line"
  | "line-markers"
  | "step"
  | "area"
  | "baseline"
  | "columns";

export const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "hollow", label: "Hollow candles" },
  { id: "bars", label: "Bars" },
  { id: "heikin", label: "Heikin Ashi" },
  { id: "line", label: "Line" },
  { id: "line-markers", label: "Line with markers" },
  { id: "step", label: "Step line" },
  { id: "area", label: "Area" },
  { id: "baseline", label: "Baseline" },
  { id: "columns", label: "Columns" },
];

const UP = "#089981"; // TradingView green
const DOWN = "#f23645"; // TradingView red
const BLUE = "#2962FF";

const THEMES = {
  dark: { bg: "#131722", text: "#d1d4dc", grid: "#1e222d", border: "#2a2e39" },
  light: { bg: "#ffffff", text: "#131722", grid: "#f0f3fa", border: "#e0e3eb" },
} as const;

// ---- IST display ------------------------------------------------------------
// Data stays in real UTC; only the labels are formatted in Indian Standard Time.
const IST = "Asia/Kolkata";
const mkFmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...o });
const F = {
  year: mkFmt({ year: "numeric" }),
  month: mkFmt({ month: "short" }),
  day: mkFmt({ day: "numeric" }),
  clock: mkFmt({ hour: "2-digit", minute: "2-digit", hour12: false }),
  date: mkFmt({ day: "2-digit", month: "short", year: "numeric" }),
  dateTime: mkFmt({ day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
};
const toDate = (t: Time) => new Date((typeof t === "number" ? t : 0) * 1000);

function istTickMark(time: Time, type: TickMarkType) {
  const d = toDate(time);
  switch (type) {
    case TickMarkType.Year: return F.year.format(d);
    case TickMarkType.Month: return F.month.format(d);
    case TickMarkType.DayOfMonth: return F.day.format(d);
    default: return F.clock.format(d); // Time / TimeWithSeconds
  }
}

/** Convert candles into the point shape each series type expects. */
function toSeriesData(type: ChartType, candles: Candle[]) {
  switch (type) {
    case "candles":
    case "hollow":
    case "bars":
      return candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
    case "heikin":
      return toHeikinAshi(candles).map(({ time, open, high, low, close }) => ({
        time, open, high, low, close,
      }));
    case "columns":
      return candles.map((c) => ({ time: c.time, value: c.close, color: c.close >= c.open ? UP : DOWN }));
    default: // line, line-markers, step, area, baseline
      return candles.map((c) => ({ time: c.time, value: c.close }));
  }
}

function addMainSeries(chart: IChartApi, type: ChartType, candles: Candle[]): ISeriesApi<SeriesType> {
  const data = toSeriesData(type, candles);
  let s: ISeriesApi<SeriesType>;

  switch (type) {
    case "candles":
    case "heikin":
      s = chart.addSeries(CandlestickSeries, {
        upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
      });
      break;
    case "hollow":
      s = chart.addSeries(CandlestickSeries, {
        upColor: "rgba(0,0,0,0)", downColor: DOWN,
        borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
      });
      break;
    case "bars":
      s = chart.addSeries(BarSeries, { upColor: UP, downColor: DOWN });
      break;
    case "line":
      s = chart.addSeries(LineSeries, { color: BLUE, lineWidth: 2 });
      break;
    case "line-markers":
      s = chart.addSeries(LineSeries, { color: BLUE, lineWidth: 2, pointMarkersVisible: true });
      break;
    case "step":
      s = chart.addSeries(LineSeries, { color: BLUE, lineWidth: 2, lineType: LineType.WithSteps });
      break;
    case "area":
      s = chart.addSeries(AreaSeries, {
        lineColor: BLUE, lineWidth: 2,
        topColor: "rgba(41,98,255,0.28)", bottomColor: "rgba(41,98,255,0)",
      });
      break;
    case "baseline":
      s = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: candles[0]?.close ?? 0 },
        topLineColor: UP, topFillColor1: "rgba(38,166,154,0.28)", topFillColor2: "rgba(38,166,154,0.05)",
        bottomLineColor: DOWN, bottomFillColor1: "rgba(239,83,80,0.05)", bottomFillColor2: "rgba(239,83,80,0.28)",
      });
      break;
    case "columns":
      s = chart.addSeries(HistogramSeries, { priceFormat: { type: "price" } });
      break;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as ISeriesApi<any>).setData(data);
  return s;
}

type Props = {
  symbol: string;
  /** Normalized candles (see normalizeCandles in lib/chart-data.ts). */
  data: Candle[];
  interval?: Interval;
  intervals?: readonly Interval[];
  /** Called when the user clicks a timeframe: fetch new data for it in the parent. */
  onIntervalChange?: (i: Interval) => void;
  /** Push a live tick / forming candle here (same shape as a Candle). */
  liveBar?: Candle | null;
  /** Shows a small Live / Connecting badge in the toolbar. */
  liveStatus?: "off" | "connecting" | "live" | "reconnecting";
  initialType?: ChartType;
  height?: number | string;
  theme?: "dark" | "light";
  /** Called whenever the user toggles the chart theme. */
  onThemeChange?: (t: "dark" | "light") => void;
};

export default function TradingChart({
  symbol,
  data,
  interval = "1D",
  intervals = INTERVALS,
  onIntervalChange,
  liveBar,
  liveStatus,
  initialType = "hollow",
  height = 560,
  theme: initialTheme = "dark",
  onThemeChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const barsRef = useRef<Candle[]>([]);
  const prevDataRef = useRef<Candle[] | null>(null);

  const [type, setType] = useState<ChartType>(initialType);
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
  const [showVolume, setShowVolume] = useState(true);
  const [hover, setHover] = useState<Candle | null>(null);

  const byTime = useMemo(() => new Map(data.map((c) => [c.time as number, c])), [data]);
  const last = data[data.length - 1] ?? null;

  // 1) create the chart once
  useEffect(() => {
    if (!hostRef.current) return;
    const chart = createChart(hostRef.current, {
      autoSize: true, // follows the container size
      crosshair: { mode: CrosshairMode.Normal },
      layout: { attributionLogo: false },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        tickMarkFormatter: istTickMark,
      },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  // 2a) follow the theme chosen by the parent (dashboard toggle)
  useEffect(() => setTheme(initialTheme), [initialTheme]);

  // 2) theme
  useEffect(() => {
    const t = THEMES[theme];
    chartRef.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: t.bg }, textColor: t.text },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    });
    onThemeChange?.(theme);
  }, [theme, onThemeChange]);

  // 2b) crosshair time label in IST (date only for daily/weekly)
  useEffect(() => {
    const dateOnly = interval === "1D" || interval === "1W";
    chartRef.current?.applyOptions({
      localization: {
        timeFormatter: (t: Time) => (dateOnly ? F.date : F.dateTime).format(toDate(t)),
      },
    });
  }, [interval]);

  // 3) main series: rebuilt when chart type or data changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (mainRef.current) chart.removeSeries(mainRef.current);

    // New data -> start from it. Style-only change -> keep the live bars already appended.
    const dataChanged = prevDataRef.current !== data;
    prevDataRef.current = data;
    const src = dataChanged ? data : barsRef.current;
    barsRef.current = [...src];
    mainRef.current = addMainSeries(chart, type, src);

    if (dataChanged || !range) chart.timeScale().fitContent(); // new timeframe -> fit
    else chart.timeScale().setVisibleLogicalRange(range); // only style changed -> keep zoom
  }, [type, data]);

  // 4) volume histogram on its own overlay scale
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (volumeRef.current) {
      chart.removeSeries(volumeRef.current);
      volumeRef.current = null;
    }
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.08, bottom: showVolume ? 0.25 : 0.08 },
    });
    if (!showVolume) return;

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "", // overlay, separate from the price scale
      lastValueVisible: false,
      priceLineVisible: false,
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(
      barsRef.current
        .filter((c) => c.volume != null)
        .map((c) => ({
          time: c.time,
          value: c.volume as number,
          color: c.close >= c.open ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)",
        })),
    );
    volumeRef.current = vol;
  }, [data, showVolume, type]);

  // 5) legend follows the crosshair
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (p: { time?: unknown }) => setHover(p.time ? byTime.get(p.time as number) ?? null : null);
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [byTime]);

  // 6) live updates (websocket / polling) without resetting the chart
  useEffect(() => {
    if (!liveBar || !mainRef.current) return;
    const bars = barsRef.current;
    const newest = bars[bars.length - 1]?.time;
    if (newest !== undefined && liveBar.time < newest) return; // stale tick: series.update() would throw
    const i = bars.findIndex((b) => b.time === liveBar.time);
    if (i >= 0) bars[i] = liveBar;
    else bars.push(liveBar);

    // Heikin Ashi depends on previous bars, so recompute; others map one bar.
    const src = type === "heikin" ? bars : [liveBar];
    const point = toSeriesData(type, src).at(-1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (point) (mainRef.current as ISeriesApi<any>).update(point);

    if (volumeRef.current && liveBar.volume != null) {
      volumeRef.current.update({
        time: liveBar.time,
        value: liveBar.volume,
        color: liveBar.close >= liveBar.open ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)",
      });
    }
  }, [liveBar, type]);

  const shown = hover ?? liveBar ?? last;
  const change = shown ? ((shown.close - shown.open) / shown.open) * 100 : 0;
  const tone = shown && shown.close >= shown.open ? styles.up : styles.down;
  const fmt = (n?: number) => (n == null ? "-" : n.toLocaleString(undefined, { maximumFractionDigits: 4 }));

  return (
    <div className={styles.wrap} data-theme={theme} style={{ height }}>
      <div className={styles.toolbar} role="toolbar" aria-label="Chart controls">
        <div className={styles.group}>
          {intervals.map((i) => (
            <button
              key={i}
              type="button"
              className={`${styles.btn} ${i === interval ? styles.active : ""}`}
              aria-pressed={i === interval}
              onClick={() => onIntervalChange?.(i)}
            >
              {i}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          {/* {liveStatus && liveStatus !== "off" && (
            <span className={`${styles.status} ${styles[liveStatus]}`} role="status">
              <i className={styles.dot} />
              {liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Reconnecting"}
            </span>
          )} */}
          <select
            className={styles.select}
            value={type}
            aria-label="Chart type"
            onChange={(e) => setType(e.target.value as ChartType)}
          >
            {CHART_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.btn} ${showVolume ? styles.active : ""}`}
            aria-pressed={showVolume}
            onClick={() => setShowVolume((v) => !v)}
          >
            Volume
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      <div className={styles.stage}>
        <div className={styles.legend}>
          <strong>{symbol}</strong> <span className={styles.muted}>{interval} IST</span>
          {shown && (
            <span className={tone}>
              {" "}O {fmt(shown.open)} H {fmt(shown.high)} L {fmt(shown.low)} C {fmt(shown.close)}{" "}
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              {shown.volume != null && <span className={styles.muted}> Vol {fmt(shown.volume)}</span>}
            </span>
          )}
        </div>
        <div ref={hostRef} className={styles.chart} />
      </div>
    </div>
  );
}