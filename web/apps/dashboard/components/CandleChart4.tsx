'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  candleLayout,
  applyLivePrice,
  priceRange,
  scaleY,
  type Candle,
  type CandleResponse,
} from '@/lib/candles';
import { formatPrice } from '@/lib/format';
import { getCompareList, COMPARE_EVENT, type CompareEntry } from '@/lib/compare-stocks';

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002';
const QUAD_H = 300;
const DAILY_H = 440;
const YAXIS_W = 58;
const XAXIS_H = 22;
const TITLE_H = 26;
const MODAL_CHART_H = 540;
const POLL_MS = 5_000;
const MIN_VISIBLE = 10;
const ZOOM_STEP = 5;
const Y_PADDING_RATIO = 0.06;

interface IntradayBar {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type QuadKey = 'q1' | 'q2' | 'q3' | 'q4';
type DaysOption = 90 | 180 | 270 | 365;

interface PatternSignal {
  type: 'BUY' | 'SELL';
  label: string;
  candleIndex: number;
}

// ── SVG utils ──────────────────────────────────────────────────
function sy(v: number, min: number, max: number, h: number): number {
  if (max === min) return h / 2;
  return h - ((v - min) / (max - min)) * h;
}

function niceYTicks(min: number, max: number, n = 4): number[] {
  if (max === min) return [Math.round(min)];
  const range = max - min;
  const rough = range / n;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const interval = ([1, 2, 2.5, 5, 10].find(f => f * pow >= rough) ?? 10) * pow;
  const start = Math.ceil(min / interval) * interval;
  const ticks: number[] = [];
  for (let t = start; t <= max + interval * 0.01; t += interval) {
    const v = Math.round(t * 100) / 100;
    if (v >= min && v <= max) ticks.push(v);
  }
  return ticks;
}

// ── Pattern detection ──────────────────────────────────────────
function linRegSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function localMins(arr: number[], hw = 3): number[] {
  const res: number[] = [];
  for (let i = hw; i < arr.length - hw; i++) {
    let ok = true;
    for (let j = i - hw; j <= i + hw; j++) {
      if (j !== i && arr[j] <= arr[i]) { ok = false; break; }
    }
    if (ok) res.push(i);
  }
  return res;
}

function localMaxs(arr: number[], hw = 3): number[] {
  const res: number[] = [];
  for (let i = hw; i < arr.length - hw; i++) {
    let ok = true;
    for (let j = i - hw; j <= i + hw; j++) {
      if (j !== i && arr[j] >= arr[i]) { ok = false; break; }
    }
    if (ok) res.push(i);
  }
  return res;
}

function detectPatterns(candles: Candle[]): PatternSignal[] {
  const signals: PatternSignal[] = [];
  const n = candles.length;
  if (n < 20) return signals;

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const lb = Math.min(n, 80);
  const off = n - lb;
  const rH = highs.slice(off);
  const rL = lows.slice(off);
  const rC = closes.slice(off);

  const lMins = localMins(rL, 3);
  const lMaxs = localMaxs(rH, 3);

  // Double Bottom (BUY)
  for (let k = lMins.length - 1; k >= 1; k--) {
    const i1 = lMins[k - 1], i2 = lMins[k];
    if (i2 - i1 < 5) continue;
    const v1 = rL[i1], v2 = rL[i2];
    if (Math.abs(v1 - v2) / ((v1 + v2) / 2) < 0.04) {
      signals.push({ type: 'BUY', label: '더블바텀', candleIndex: off + i2 });
      break;
    }
  }

  // Double Top (SELL)
  for (let k = lMaxs.length - 1; k >= 1; k--) {
    const i1 = lMaxs[k - 1], i2 = lMaxs[k];
    if (i2 - i1 < 5) continue;
    const v1 = rH[i1], v2 = rH[i2];
    if (Math.abs(v1 - v2) / ((v1 + v2) / 2) < 0.04) {
      signals.push({ type: 'SELL', label: '더블탑', candleIndex: off + i2 });
      break;
    }
  }

  // Inverse H&S (BUY)
  if (lMins.length >= 3) {
    const [ls, h, rs] = lMins.slice(-3);
    const lsV = rL[ls], hV = rL[h], rsV = rL[rs];
    const sim = Math.abs(lsV - rsV) / ((lsV + rsV) / 2);
    if (hV < lsV && hV < rsV && sim < 0.06 && h - ls >= 3 && rs - h >= 3) {
      signals.push({ type: 'BUY', label: '역헤드앤솔더', candleIndex: off + rs });
    }
  }

  // H&S (SELL)
  if (lMaxs.length >= 3) {
    const [ls, h, rs] = lMaxs.slice(-3);
    const lsV = rH[ls], hV = rH[h], rsV = rH[rs];
    const sim = Math.abs(lsV - rsV) / ((lsV + rsV) / 2);
    if (hV > lsV && hV > rsV && sim < 0.06 && h - ls >= 3 && rs - h >= 3) {
      signals.push({ type: 'SELL', label: '헤드앤솔더', candleIndex: off + rs });
    }
  }

  // Bull Flag (BUY)
  if (lb >= 20) {
    const pS = rC.length - 20, pE = rC.length - 10;
    const poleMove = (rC[pE] - rC[pS]) / rC[pS];
    if (poleMove > 0.04) {
      const flagC = rC.slice(pE);
      const flagRange = (Math.max(...flagC) - Math.min(...flagC)) / rC[pE];
      if (linRegSlope(flagC) <= 0 && flagRange < 0.06) {
        signals.push({ type: 'BUY', label: '상승폴래그', candleIndex: n - 1 });
      }
    }
  }

  // Bear Flag (SELL)
  if (lb >= 20) {
    const pS = rC.length - 20, pE = rC.length - 10;
    const poleMove = (rC[pE] - rC[pS]) / rC[pS];
    if (poleMove < -0.04) {
      const flagC = rC.slice(pE);
      const flagRange = (Math.max(...flagC) - Math.min(...flagC)) / Math.abs(rC[pE]);
      if (linRegSlope(flagC) >= 0 && flagRange < 0.06) {
        signals.push({ type: 'SELL', label: '하락폴래그', candleIndex: n - 1 });
      }
    }
  }

  // Ascending Triangle (BUY)
  {
    const win = Math.min(25, lb);
    const wH = rH.slice(-win), wL = rL.slice(-win);
    const maxH = Math.max(...wH), minH = Math.min(...wH);
    const highFlat = (maxH - minH) / maxH < 0.025;
    const lowSlope = linRegSlope(wL);
    const highSlope = linRegSlope(wH);
    if (highFlat && lowSlope > 0 && Math.abs(highSlope) < Math.abs(lowSlope) * 0.5) {
      signals.push({ type: 'BUY', label: '상승삼각형', candleIndex: n - 1 });
    }
  }

  // Descending Triangle (SELL)
  {
    const win = Math.min(25, lb);
    const wH = rH.slice(-win), wL = rL.slice(-win);
    const maxL = Math.max(...wL), minL = Math.min(...wL);
    const lowFlat = (maxL - minL) / maxL < 0.025;
    const highSlope = linRegSlope(wH);
    const lowSlope = linRegSlope(wL);
    if (lowFlat && highSlope < 0 && Math.abs(lowSlope) < Math.abs(highSlope) * 0.5) {
      signals.push({ type: 'SELL', label: '하락삼각형', candleIndex: n - 1 });
    }
  }

  // Falling Wedge = 쏘사나단 (BUY): both H and L declining, converging
  {
    const win = Math.min(20, lb);
    const hs = linRegSlope(rH.slice(-win));
    const ls = linRegSlope(rL.slice(-win));
    if (hs < 0 && ls < 0 && ls > hs && Math.abs(hs - ls) / Math.abs(hs) > 0.2) {
      signals.push({ type: 'BUY', label: '쏘사나단', candleIndex: n - 1 });
    }
  }

  // Rising Wedge = 쏘성 바람 (SELL): both H and L rising, converging
  {
    const win = Math.min(20, lb);
    const hs = linRegSlope(rH.slice(-win));
    const ls = linRegSlope(rL.slice(-win));
    if (hs > 0 && ls > 0 && hs < ls && Math.abs(ls - hs) / Math.abs(ls) > 0.2) {
      signals.push({ type: 'SELL', label: '쏘성바람', candleIndex: n - 1 });
    }
  }

  // ── 캔들(단·복합 봉) 패턴 — 최신 봉 기준 사세요(BUY)/팔아요(SELL) 신호 ─────
  // 첨부 인포그래픽의 봉조합 신호를 표준 캔들 패턴으로 구현(OHLC 결정적 판정).
  const body  = (c: Candle) => Math.abs(c.close - c.open);
  const upSh  = (c: Candle) => c.high - Math.max(c.open, c.close);
  const loSh  = (c: Candle) => Math.min(c.open, c.close) - c.low;
  const bull  = (c: Candle) => c.close > c.open;
  const bear  = (c: Candle) => c.close < c.open;
  // 신호봉 직전 6봉 종가 기울기(정규화) — 추세 맥락 판정.
  const trendBefore = (idx: number) => {
    const seg = closes.slice(Math.max(0, idx - 6), idx);
    return seg.length < 3 ? 0 : linRegSlope(seg) / (seg[0] || 1);
  };

  const L = n - 1;
  const c0 = candles[L], c1 = candles[L - 1], c2 = candles[L - 2];
  const downBefore = trendBefore(L) < -0.002;
  const upBefore   = trendBefore(L) > 0.002;

  // 망치형 (BUY): 하락 후 긴 아래꼬리 + 작은 몸통
  if (downBefore && body(c0) > 0 && loSh(c0) >= body(c0) * 2 && upSh(c0) <= body(c0))
    signals.push({ type: 'BUY', label: '망치형', candleIndex: L });
  // 역망치형 (BUY): 바닥권에서 긴 위꼬리 + 작은 몸통
  if (downBefore && body(c0) > 0 && upSh(c0) >= body(c0) * 2 && loSh(c0) <= body(c0))
    signals.push({ type: 'BUY', label: '역망치형', candleIndex: L });
  // 유성형 (SELL): 상승 후 긴 위꼬리 + 작은 몸통
  if (upBefore && body(c0) > 0 && upSh(c0) >= body(c0) * 2 && loSh(c0) <= body(c0))
    signals.push({ type: 'SELL', label: '유성형', candleIndex: L });
  // 상승장악형 (BUY): 음봉 뒤 직전 몸통을 덮는 큰 양봉
  if (bear(c1) && bull(c0) && c0.close >= c1.open && c0.open <= c1.close && body(c0) > body(c1))
    signals.push({ type: 'BUY', label: '상승장악형', candleIndex: L });
  // 하락장악형 (SELL): 양봉 뒤 직전 몸통을 덮는 큰 음봉
  if (bull(c1) && bear(c0) && c0.open >= c1.close && c0.close <= c1.open && body(c0) > body(c1))
    signals.push({ type: 'SELL', label: '하락장악형', candleIndex: L });
  // 샛별형 (BUY): 음봉 + 작은 몸통 + 큰 양봉 (3봉 상승 반전)
  if (bear(c2) && body(c1) < body(c2) * 0.5 && bull(c0) && c0.close > (c2.open + c2.close) / 2)
    signals.push({ type: 'BUY', label: '샛별형', candleIndex: L });
  // 석별형 (SELL): 양봉 + 작은 몸통 + 큰 음봉 (3봉 하락 반전)
  if (bull(c2) && body(c1) < body(c2) * 0.5 && bear(c0) && c0.close < (c2.open + c2.close) / 2)
    signals.push({ type: 'SELL', label: '석별형', candleIndex: L });
  // 적삼병 (BUY): 연속 3 양봉, 종가 상승
  if (bull(c0) && bull(c1) && bull(c2) && c0.close > c1.close && c1.close > c2.close)
    signals.push({ type: 'BUY', label: '적삼병', candleIndex: L });
  // 흑삼병 (SELL): 연속 3 음봉, 종가 하락
  if (bear(c0) && bear(c1) && bear(c2) && c0.close < c1.close && c1.close < c2.close)
    signals.push({ type: 'SELL', label: '흑삼병', candleIndex: L });

  const seen = new Set<string>();
  return signals.filter(s => {
    const key = `${s.type}:${s.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── ExpandBtn ──────────────────────────────────────────────────
function ExpandBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="전체화면"
      style={{
        position: 'absolute', top: 5, right: 6, zIndex: 3,
        background: 'none', border: '1px solid var(--color-border)',
        borderRadius: 3, padding: '1px 5px', cursor: 'pointer',
        fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.3,
      }}
    >⛶</button>
  );
}

// ── Q1: 금일(또는 최근 거래일) 5분봉 ─────────────────────────────
function IntradayLineChart({ ticker, compareList = [], height = QUAD_H, onExpand }: { ticker: string; compareList?: CompareEntry[]; height?: number; onExpand?: () => void }) {
  const [bars, setBars] = useState<IntradayBar[]>([]);
  const [err, setErr] = useState('');
  const [w, setW] = useState(400);
  const [visCount, setVisCount] = useState(78);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; time: string } | null>(null);
  const [compareBars, setCompareBars] = useState<Map<string, IntradayBar[]>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(e => setW(Math.floor(e[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ticker) return;
    fetch(`${BFF}/api/intraday/${ticker}?interval=5m`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setBars(Array.isArray(d?.bars) ? d.bars : []))
      .catch(e => setErr(String(e)));
  }, [ticker]);

  useEffect(() => {
    if (compareList.length === 0) { setCompareBars(new Map()); return; }
    let cancelled = false;
    Promise.allSettled(compareList.map(e =>
      fetch(`${BFF}/api/intraday/${e.ticker}?interval=5m`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => [e.ticker, Array.isArray(d?.bars) ? d.bars as IntradayBar[] : []] as const)
        .catch(() => [e.ticker, [] as IntradayBar[]] as const)
    )).then(res => {
      if (cancelled) return;
      const m = new Map<string, IntradayBar[]>();
      res.forEach(r => { if (r.status === 'fulfilled') m.set(r.value[0], r.value[1]); });
      setCompareBars(m);
    });
    return () => { cancelled = true; };
  }, [compareList]);

  const today = new Date().toISOString().slice(0, 10);
  const todayBars = bars.filter(b => b.datetime.startsWith(today));
  const lastDay = bars.length > 0 ? bars[bars.length - 1].datetime.slice(0, 10) : '';
  const sessionBars = todayBars.length > 0 ? todayBars : (lastDay ? bars.filter(b => b.datetime.startsWith(lastDay)) : bars);
  const totalBars = sessionBars.length > 0 ? sessionBars : bars;
  const display = totalBars.slice(-Math.min(visCount, totalBars.length));

  const innerH = height - XAXIS_H - TITLE_H;
  const chartW = w - YAXIS_W;
  const closes = display.map(b => b.close).filter(v => v > 0);
  const minV = closes.length > 0 ? Math.min(...closes) * 0.9995 : 0;
  const maxV = closes.length > 0 ? Math.max(...closes) * 1.0005 : 1;
  const yTicks = niceYTicks(minV, maxV);

  const pts = display.map((b, i) => {
    const x = (i / Math.max(display.length - 1, 1)) * chartW;
    const y = sy(b.close, minV, maxV, innerH);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const xLabels: { x: number; label: string }[] = [];
  if (display.length > 1) {
    const step = Math.max(1, Math.floor(display.length / 6));
    for (let i = 0; i < display.length; i += step) {
      xLabels.push({ x: (i / Math.max(display.length - 1, 1)) * chartW, label: display[i].datetime.split(' ')[1]?.slice(0, 5) ?? '' });
    }
  }

  const isToday = lastDay === today || todayBars.length > 0;
  const dateLabel = display.length > 0 ? display[0].datetime.slice(0, 10) : '';

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', padding: '4px 8px 0', fontWeight: 600, height: TITLE_H, display: 'flex', alignItems: 'center', gap: 6 }}>
        금일 5분봉
        {dateLabel && <span style={{ fontWeight: 400, fontSize: 10 }}>({dateLabel}{!isToday ? ' · 장마감' : ''})</span>}
        <span style={{ fontSize: 9, opacity: 0.5 }}>스크롤 줌 · {display.length}봉</span>
      </div>
      {onExpand && <ExpandBtn onClick={onExpand} />}
      {err && <div style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 8px' }}>⚠ {err}</div>}
      {display.length === 0 ? (
        <div style={{ height: height - TITLE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: 12 }}>데이터 없음</div>
      ) : (
        <svg width={w} height={height - TITLE_H} style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
          onWheel={e => { e.preventDefault(); setVisCount(prev => Math.max(10, Math.min(totalBars.length || 200, prev + (e.deltaY > 0 ? 10 : -10)))); }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = (e.clientX - rect.left) * (w / rect.width);
            if (svgX >= chartW || display.length < 2) { setTooltip(null); return; }
            const idx = Math.round((svgX / chartW) * (display.length - 1));
            const b = display[Math.max(0, Math.min(display.length - 1, idx))];
            if (b) setTooltip({ x: e.clientX, y: e.clientY, price: b.close, time: b.datetime.split(' ')[1]?.slice(0, 5) ?? '' });
          }}
          onMouseLeave={() => setTooltip(null)}>
          {yTicks.map(tick => {
            const y = sy(tick, minV, maxV, innerH);
            return (
              <g key={tick}>
                <line x1={0} x2={chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3,4" />
                <text x={chartW + 3} y={y + 4} fontSize={9} fill="var(--color-muted)">{tick >= 1000 ? tick.toLocaleString('ko-KR') : tick}</text>
              </g>
            );
          })}
          <line x1={chartW} x2={chartW} y1={0} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
          <line x1={0} x2={chartW} y1={innerH} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
          {display.length > 1 && <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />}
          {display.length > 0 && (() => {
            const y = sy(display[display.length - 1].close, minV, maxV, innerH);
            return <circle cx={chartW} cy={y} r={3} fill="var(--color-accent)" />;
          })()}
          {compareList.length > 0 && display.length > 0 && (() => {
            const mainBase = display[0].close;
            if (mainBase === 0) return null;
            return compareList.map(e => {
              const cBars = compareBars.get(e.ticker) ?? [];
              const cDate = display[0].datetime.slice(0, 10);
              const cSession = cBars.filter(b => b.datetime.startsWith(cDate));
              const cDisplay = cSession.length > 0 ? cSession : cBars.slice(-Math.min(visCount, cBars.length));
              if (cDisplay.length < 2) return null;
              const cBase = cDisplay[0].close;
              if (cBase === 0) return null;
              const cPts = cDisplay.map((b, i) => {
                const pct = (b.close - cBase) / cBase;
                const x = (i / Math.max(cDisplay.length - 1, 1)) * chartW;
                const y = sy(mainBase * (1 + pct), minV, maxV, innerH);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ');
              return <polyline key={e.ticker} points={cPts} fill="none" stroke={e.color} strokeWidth={1.5} strokeOpacity={0.85} />;
            });
          })()}
          {xLabels.map(({ x, label }, i) => (
            <text key={i} x={x} y={innerH + XAXIS_H - 4} fontSize={9} fill="var(--color-muted)" textAnchor="middle">{label}</text>
          ))}
        </svg>
      )}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 8px', fontSize: 11, pointerEvents: 'none', zIndex: 9999 }}>
          <span style={{ color: 'var(--color-muted)', marginRight: 4 }}>{tooltip.time}</span>
          <span style={{ fontWeight: 700 }}>{tooltip.price.toLocaleString('ko-KR')}원</span>
        </div>
      )}
    </div>
  );
}

// ── Q2: 시간대별 평균 수익률 ────────────────────────────────────
function HourlyPatternChart({ ticker, compareList = [], height = QUAD_H, onExpand }: { ticker: string; compareList?: CompareEntry[]; height?: number; onExpand?: () => void }) {
  const [bars, setBars] = useState<IntradayBar[]>([]);
  const [err, setErr] = useState('');
  const [w, setW] = useState(400);
  const [yZoom, setYZoom] = useState(1);
  const [compareBarMap, setCompareBarMap] = useState<Map<string, IntradayBar[]>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(e => setW(Math.floor(e[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ticker) return;
    fetch(`${BFF}/api/intraday/${ticker}?interval=5m`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setBars(Array.isArray(d?.bars) ? d.bars : []))
      .catch(e => setErr(String(e)));
  }, [ticker]);

  useEffect(() => {
    if (compareList.length === 0) { setCompareBarMap(new Map()); return; }
    let cancelled = false;
    Promise.allSettled(compareList.map(e =>
      fetch(`${BFF}/api/intraday/${e.ticker}?interval=5m`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => [e.ticker, Array.isArray(d?.bars) ? d.bars as IntradayBar[] : []] as const)
        .catch(() => [e.ticker, [] as IntradayBar[]] as const)
    )).then(res => {
      if (cancelled) return;
      const m = new Map<string, IntradayBar[]>();
      res.forEach(r => { if (r.status === 'fulfilled') m.set(r.value[0], r.value[1]); });
      setCompareBarMap(m);
    });
    return () => { cancelled = true; };
  }, [compareList]);

  const hourReturns: Record<number, number[]> = {};
  const dayGroups: Record<string, IntradayBar[]> = {};
  for (const b of bars) (dayGroups[b.datetime.slice(0, 10)] ??= []).push(b);
  for (const dBars of Object.values(dayGroups)) {
    const sorted = [...dBars].sort((a, b) => a.datetime.localeCompare(b.datetime));
    const dayOpen = sorted[0]?.open ?? 0;
    if (dayOpen === 0) continue;
    const hGroups: Record<number, IntradayBar[]> = {};
    for (const b of sorted) {
      const h = parseInt(b.datetime.split(' ')[1]?.split(':')[0] ?? '0');
      if (h >= 9 && h <= 15) (hGroups[h] ??= []).push(b);
    }
    for (const [hStr, hBars] of Object.entries(hGroups)) {
      const h = parseInt(hStr);
      const last = hBars[hBars.length - 1].close;
      (hourReturns[h] ??= []).push((last - dayOpen) / dayOpen * 100);
    }
  }

  const HOURS = [9, 10, 11, 12, 13, 14, 15];
  const avgs = HOURS.map(h => {
    const vals = hourReturns[h];
    return vals?.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  const innerH = height - XAXIS_H - TITLE_H;
  const chartW = w - YAXIS_W;
  const maxAbsRaw = Math.max(...avgs.map(Math.abs), 0.05);
  const maxAbs = maxAbsRaw / yZoom;
  const barW = Math.max(8, chartW / HOURS.length * 0.62);
  function yScale(v: number) { return innerH / 2 - (Math.max(-maxAbs, Math.min(maxAbs, v)) / maxAbs) * (innerH / 2 - 6); }
  const noData = avgs.every(v => Math.abs(v) < 0.001);

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', padding: '4px 8px 0', fontWeight: 600, height: TITLE_H, display: 'flex', alignItems: 'center', gap: 6 }}>
        시간대별 평균 수익률 <span style={{ fontSize: 9, opacity: 0.5 }}>스크롤 Y줌</span>
      </div>
      {onExpand && <ExpandBtn onClick={onExpand} />}
      {err && <div style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 8px' }}>⚠ {err}</div>}
      <svg width={w} height={height - TITLE_H} style={{ display: 'block', cursor: 'ns-resize', userSelect: 'none' }}
        onWheel={e => { e.preventDefault(); setYZoom(prev => Math.max(0.2, Math.min(8, prev + (e.deltaY > 0 ? -0.2 : 0.2)))); }}>
        {[0.25, 0.5, 0.75].map(f => {
          const y = f * innerH;
          return <line key={f} x1={0} x2={chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} strokeDasharray={f === 0.5 ? undefined : '3,4'} />;
        })}
        <line x1={chartW} x2={chartW} y1={0} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
        <text x={chartW + 3} y={8} fontSize={9} fill="var(--color-muted)">+{maxAbs.toFixed(2)}%</text>
        <text x={chartW + 3} y={innerH / 2 + 4} fontSize={9} fill="var(--color-muted)">0%</text>
        <text x={chartW + 3} y={innerH} fontSize={9} fill="var(--color-muted)">-{maxAbs.toFixed(2)}%</text>
        <line x1={0} x2={chartW} y1={innerH} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
        {HOURS.map((h, i) => {
          const x = (i + 0.5) / HOURS.length * chartW;
          const v = avgs[i];
          const y0 = innerH / 2, y1 = yScale(v);
          const bTop = Math.min(y0, y1), bH = Math.abs(y0 - y1);
          const color = v >= 0 ? 'var(--color-up)' : 'var(--color-down)';
          return (
            <g key={h}>
              <rect x={x - barW / 2} y={bTop} width={barW} height={Math.max(bH, 1)} fill={color} opacity={0.85} />
              <text x={x} y={innerH + XAXIS_H - 4} fontSize={9} fill="var(--color-muted)" textAnchor="middle">{h}시</text>
              {bH > 14 && <text x={x} y={v >= 0 ? bTop - 2 : bTop + bH + 10} fontSize={8} fill={color} textAnchor="middle">{v >= 0 ? '+' : ''}{v.toFixed(2)}%</text>}
            </g>
          );
        })}
        {noData && <text x={chartW / 2} y={innerH / 2 + 4} fontSize={11} fill="var(--color-muted)" textAnchor="middle">데이터 집계 중…</text>}
        {compareList.map(e => {
          const cBars = compareBarMap.get(e.ticker) ?? [];
          const cHourRet: Record<number, number[]> = {};
          const cDayGrp: Record<string, IntradayBar[]> = {};
          for (const b of cBars) (cDayGrp[b.datetime.slice(0, 10)] ??= []).push(b);
          for (const dBars of Object.values(cDayGrp)) {
            const sorted = [...dBars].sort((a, b) => a.datetime.localeCompare(b.datetime));
            const dayOpen = sorted[0]?.open ?? 0;
            if (dayOpen === 0) continue;
            const hGrp: Record<number, IntradayBar[]> = {};
            for (const b of sorted) {
              const h = parseInt(b.datetime.split(' ')[1]?.split(':')[0] ?? '0');
              if (h >= 9 && h <= 15) (hGrp[h] ??= []).push(b);
            }
            for (const [hStr, hBars] of Object.entries(hGrp)) {
              const h = parseInt(hStr);
              (cHourRet[h] ??= []).push((hBars[hBars.length - 1].close - dayOpen) / dayOpen * 100);
            }
          }
          const cAvgs = HOURS.map(h => { const v = cHourRet[h]; return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
          const pts = HOURS.map((h, i) => { const v = cAvgs[i]; if (v === null) return null; return `${((i + 0.5) / HOURS.length * chartW).toFixed(1)},${yScale(v).toFixed(1)}`; }).filter(Boolean) as string[];
          return (
            <g key={e.ticker}>
              {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke={e.color} strokeWidth={1.5} strokeDasharray="4,3" />}
              {HOURS.map((h, i) => { const v = cAvgs[i]; if (v === null) return null; return <circle key={h} cx={(i + 0.5) / HOURS.length * chartW} cy={yScale(v)} r={3.5} fill={e.color} />; })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Q3: 요일별 평균 수익률 ─────────────────────────────────────
const KR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TRADING_DAYS = [1, 2, 3, 4, 5];

function WeekdayPatternChart({ ticker, compareList = [], height = QUAD_H, onExpand }: { ticker: string; compareList?: CompareEntry[]; height?: number; onExpand?: () => void }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState('');
  const [w, setW] = useState(400);
  const [yZoom, setYZoom] = useState(1);
  const [compareCandleMap, setCompareCandleMap] = useState<Map<string, Candle[]>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(e => setW(Math.floor(e[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ticker) return;
    fetch(`${BFF}/api/candles/${ticker}?days=90`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: CandleResponse) => setCandles(d.bars ?? []))
      .catch(e => setErr(String(e)));
  }, [ticker]);

  useEffect(() => {
    if (compareList.length === 0) { setCompareCandleMap(new Map()); return; }
    let cancelled = false;
    Promise.allSettled(compareList.map(e =>
      fetch(`${BFF}/api/candles/${e.ticker}?days=90`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((d: CandleResponse | null) => [e.ticker, d?.bars ?? []] as const)
        .catch(() => [e.ticker, [] as Candle[]] as const)
    )).then(res => {
      if (cancelled) return;
      const m = new Map<string, Candle[]>();
      res.forEach(r => { if (r.status === 'fulfilled') m.set(r.value[0], r.value[1]); });
      setCompareCandleMap(m);
    });
    return () => { cancelled = true; };
  }, [compareList]);

  const dowMap: Record<number, number[]> = {};
  for (const c of candles) {
    if (!c.date || c.open === 0) continue;
    const dow = new Date(c.date).getDay();
    (dowMap[dow] ??= []).push((c.close - c.open) / c.open * 100);
  }
  const avgs = TRADING_DAYS.map(d => {
    const vals = dowMap[d];
    return vals?.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  const innerH = height - XAXIS_H - TITLE_H;
  const chartW = w - YAXIS_W;
  const maxAbsRaw = Math.max(...avgs.map(Math.abs), 0.05);
  const maxAbs = maxAbsRaw / yZoom;
  const barW = Math.max(16, chartW / TRADING_DAYS.length * 0.55);
  function yScale(v: number) { return innerH / 2 - (Math.max(-maxAbs, Math.min(maxAbs, v)) / maxAbs) * (innerH / 2 - 6); }

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', padding: '4px 8px 0', fontWeight: 600, height: TITLE_H, display: 'flex', alignItems: 'center', gap: 6 }}>
        요일별 평균 수익률 <span style={{ fontWeight: 400, fontSize: 10 }}>(90일)</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>스크롤 Y줌</span>
      </div>
      {onExpand && <ExpandBtn onClick={onExpand} />}
      {err && <div style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 8px' }}>⚠ {err}</div>}
      <svg width={w} height={height - TITLE_H} style={{ display: 'block', cursor: 'ns-resize', userSelect: 'none' }}
        onWheel={e => { e.preventDefault(); setYZoom(prev => Math.max(0.2, Math.min(8, prev + (e.deltaY > 0 ? -0.2 : 0.2)))); }}>
        {[0.25, 0.5, 0.75].map(f => {
          const y = f * innerH;
          return <line key={f} x1={0} x2={chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} strokeDasharray={f === 0.5 ? undefined : '3,4'} />;
        })}
        <line x1={chartW} x2={chartW} y1={0} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
        <text x={chartW + 3} y={8} fontSize={9} fill="var(--color-muted)">+{maxAbs.toFixed(2)}%</text>
        <text x={chartW + 3} y={innerH / 2 + 4} fontSize={9} fill="var(--color-muted)">0%</text>
        <text x={chartW + 3} y={innerH} fontSize={9} fill="var(--color-muted)">-{maxAbs.toFixed(2)}%</text>
        <line x1={0} x2={chartW} y1={innerH} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
        {TRADING_DAYS.map((d, i) => {
          const x = (i + 0.5) / TRADING_DAYS.length * chartW;
          const v = avgs[i];
          const y0 = innerH / 2, y1 = yScale(v);
          const bTop = Math.min(y0, y1), bH = Math.abs(y0 - y1);
          const color = v >= 0 ? 'var(--color-up)' : 'var(--color-down)';
          return (
            <g key={d}>
              <rect x={x - barW / 2} y={bTop} width={barW} height={Math.max(bH, 1)} fill={color} opacity={0.85} />
              <text x={x} y={innerH + XAXIS_H - 4} fontSize={10} fill="var(--color-muted)" textAnchor="middle">{KR_DAYS[d]}</text>
              {bH > 14 && <text x={x} y={v >= 0 ? bTop - 2 : bTop + bH + 10} fontSize={8} fill={color} textAnchor="middle">{v >= 0 ? '+' : ''}{v.toFixed(2)}%</text>}
            </g>
          );
        })}
        {compareList.map(e => {
          const cCandles = compareCandleMap.get(e.ticker) ?? [];
          const cDowMap: Record<number, number[]> = {};
          for (const c of cCandles) {
            if (!c.date || c.open === 0) continue;
            const dow = new Date(c.date).getDay();
            (cDowMap[dow] ??= []).push((c.close - c.open) / c.open * 100);
          }
          const cAvgs = TRADING_DAYS.map(d => { const v = cDowMap[d]; return v?.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
          const pts = TRADING_DAYS.map((d, i) => { const v = cAvgs[i]; if (v === null) return null; return `${((i + 0.5) / TRADING_DAYS.length * chartW).toFixed(1)},${yScale(v).toFixed(1)}`; }).filter(Boolean) as string[];
          return (
            <g key={e.ticker}>
              {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke={e.color} strokeWidth={1.5} strokeDasharray="4,3" />}
              {TRADING_DAYS.map((d, i) => { const v = cAvgs[i]; if (v === null) return null; return <circle key={d} cx={(i + 0.5) / TRADING_DAYS.length * chartW} cy={yScale(v)} r={3.5} fill={e.color} />; })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Q4: 일봉 캔들차트 (패턴 감지 포함) ───────────────────────────
function DailyCandleChart({ ticker, compareList = [], height = DAILY_H, onExpand }: { ticker: string; compareList?: CompareEntry[]; height?: number; onExpand?: () => void }) {
  const [days, setDays] = useState<DaysOption>(90);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(90);
  const [svgW, setSvgW] = useState(800);
  const [tooltip, setTooltip] = useState<{ candle: Candle; x: number; y: number } | null>(null);
  const [compareCandles, setCompareCandles] = useState<Map<string, Candle[]>>(new Map());
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(e => setSvgW(Math.floor(e[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`${BFF}/api/candles/${ticker}?days=${days}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`candles ${res.status}`);
        const data: CandleResponse = await res.json();
        if (alive) { setCandles(data.bars ?? []); setVisibleCount(data.bars?.length ?? days); setErr(null); }
      } catch (e) { if (alive) setErr(String(e)); }
    }
    async function pollLive() {
      try {
        const res = await fetch(`${BFF}/api/price/${ticker}`, { cache: 'no-store' });
        if (!res.ok) return;
        const p = await res.json();
        if (alive && typeof p?.price === 'number') setCandles(prev => applyLivePrice(prev, p.price));
      } catch { /* ignore */ }
    }
    load();
    timerRef.current = setInterval(pollLive, POLL_MS);
    return () => { alive = false; if (timerRef.current) clearInterval(timerRef.current); };
  }, [ticker, days]);

  useEffect(() => {
    if (compareList.length === 0) { setCompareCandles(new Map()); return; }
    let cancelled = false;
    Promise.allSettled(compareList.map(e =>
      fetch(`${BFF}/api/candles/${e.ticker}?days=${days}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((d: CandleResponse | null) => [e.ticker, d?.bars ?? []] as const)
        .catch(() => [e.ticker, [] as Candle[]] as const)
    )).then(res => {
      if (cancelled) return;
      const m = new Map<string, Candle[]>();
      res.forEach(r => { if (r.status === 'fulfilled') m.set(r.value[0], r.value[1]); });
      setCompareCandles(m);
    });
    return () => { cancelled = true; };
  }, [compareList, days]);

  const visible = candles.slice(Math.max(0, candles.length - visibleCount));
  const chartW = svgW - YAXIS_W;
  const innerH = height - XAXIS_H - TITLE_H;

  const { min: rawMin, max: rawMax } = priceRange(visible);
  const pad = (rawMax - rawMin) * Y_PADDING_RATIO;
  const pMin = rawMin - pad, pMax = rawMax + pad;

  const rects = visible.length > 0 ? candleLayout(visible, chartW, innerH, 2, pMin, pMax) : [];
  const yTicks = niceYTicks(pMin, pMax);

  const xLabels: { x: number; label: string }[] = [];
  if (visible.length > 1) {
    const slot = chartW / visible.length;
    const maxL = Math.max(2, Math.floor(chartW / 60));
    const step = Math.max(1, Math.ceil(visible.length / maxL));
    for (let k = 0; k < visible.length; k += step) {
      const parts = visible[k].date.split('-');
      xLabels.push({ x: k * slot + slot / 2, label: parts.length === 3 ? `${parts[1]}/${parts[2]}` : visible[k].date.slice(-5) });
    }
  }

  const signals = detectPatterns(candles);
  const visOffset = candles.length - visible.length;
  const slotW = visible.length > 0 ? chartW / visible.length : 0;

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', padding: '4px 8px 0', fontWeight: 600, height: TITLE_H, display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
        일봉 캔들차트
        <span style={{ fontWeight: 400, fontSize: 10 }}>({days}일 · {visible.length}봉)</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>스크롤 줌</span>
        {signals.length > 0 && (
          <span style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            {signals.filter(s => s.type === 'BUY').map(s => (
              <span key={s.label} style={{ fontSize: 8, color: 'var(--color-up)', background: 'rgba(0,180,0,0.12)', borderRadius: 3, padding: '1px 5px', border: '1px solid var(--color-up)' }}>▲ {s.label}</span>
            ))}
            {signals.filter(s => s.type === 'SELL').map(s => (
              <span key={s.label} style={{ fontSize: 8, color: 'var(--color-down)', background: 'rgba(200,0,0,0.1)', borderRadius: 3, padding: '1px 5px', border: '1px solid var(--color-down)' }}>▼ {s.label}</span>
            ))}
          </span>
        )}
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value) as DaysOption)}
          onClick={e => e.stopPropagation()}
          style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 4px', cursor: 'pointer' }}
        >
          {([90, 180, 270, 365] as DaysOption[]).map(d => <option key={d} value={d}>{d}일</option>)}
        </select>
      </div>
      {onExpand && <ExpandBtn onClick={onExpand} />}
      {err && <div style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 8px' }}>⚠ {err}</div>}
      {visible.length === 0 ? (
        <div style={{ height: innerH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: 12 }}>캔들 로딩 중…</div>
      ) : (
        <svg
          width={svgW}
          height={height - TITLE_H}
          style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
          onWheel={e => { e.preventDefault(); setVisibleCount(prev => Math.max(MIN_VISIBLE, Math.min(candles.length, prev + (e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP)))); }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = (e.clientX - rect.left) * (svgW / rect.width);
            if (svgX > chartW || visible.length === 0) { setTooltip(null); return; }
            const idx = Math.min(visible.length - 1, Math.max(0, Math.floor(svgX / slotW)));
            setTooltip({ candle: visible[idx], x: e.clientX, y: e.clientY });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Y gridlines */}
          {yTicks.map(tick => {
            const y = scaleY(tick, pMin, pMax, innerH);
            return (
              <g key={tick}>
                <line x1={0} x2={chartW} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3,4" />
                <text x={chartW + 3} y={y + 4} fontSize={9} fill="var(--color-muted)">{tick >= 1000 ? tick.toLocaleString('ko-KR') : tick}</text>
              </g>
            );
          })}
          {/* Axes */}
          <line x1={chartW} x2={chartW} y1={0} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
          <line x1={0} x2={chartW} y1={innerH} y2={innerH} stroke="var(--color-border)" strokeWidth={1} />
          {/* X labels */}
          {xLabels.map(({ x, label }, i) => (
            <text key={i} x={x} y={innerH + XAXIS_H - 4} fontSize={9} fill="var(--color-muted)" textAnchor="middle">{label}</text>
          ))}
          {/* Candles */}
          {rects.map((r, i) => {
            const fill = r.color === 'up' ? 'var(--color-up)' : 'var(--color-down)';
            return (
              <g key={i}>
                <line x1={r.wickX} x2={r.wickX} y1={r.wickTop} y2={r.wickBottom} stroke={fill} strokeWidth={1} opacity={0.85} />
                <rect x={r.x} y={r.bodyY} width={r.width} height={Math.max(r.bodyHeight, 1)} fill={fill} opacity={0.9} />
              </g>
            );
          })}
          {/* Pattern signals */}
          {signals.map(sig => {
            const visIdx = sig.candleIndex - visOffset;
            if (visIdx < 0 || visIdx >= visible.length) return null;
            const cx = visIdx * slotW + slotW / 2;
            const candle = visible[visIdx];
            const isBuy = sig.type === 'BUY';
            const color = isBuy ? 'var(--color-up)' : 'var(--color-down)';
            const baseY = isBuy
              ? scaleY(candle.low, pMin, pMax, innerH) + 8
              : scaleY(candle.high, pMin, pMax, innerH) - 8;
            const triPts = isBuy
              ? `${cx},${baseY} ${cx - 6},${baseY + 10} ${cx + 6},${baseY + 10}`
              : `${cx},${baseY} ${cx - 6},${baseY - 10} ${cx + 6},${baseY - 10}`;
            const textY = isBuy ? baseY + 20 : baseY - 13;
            return (
              <g key={`${sig.type}:${sig.label}`}>
                <polygon points={triPts} fill={color} opacity={0.9} />
                <text x={cx} y={textY} fontSize={8} fill={color} textAnchor="middle" fontWeight="bold">{sig.label}</text>
              </g>
            );
          })}
          <text x={chartW - 6} y={14} fontSize={9} fill="var(--color-muted)" textAnchor="end" opacity={0.5}>스크롤 줌 · {visible.length}봉</text>
          {compareList.length > 0 && visible.length > 0 && (() => {
            const mainBase = visible[0].close;
            if (mainBase === 0) return null;
            return compareList.map(e => {
              const cCandles = compareCandles.get(e.ticker) ?? [];
              const cInRange = cCandles.filter(c => c.date >= visible[0].date && c.date <= visible[visible.length - 1].date);
              if (cInRange.length < 2) return null;
              const cBase = cInRange[0].close;
              if (cBase === 0) return null;
              const pts = cInRange.map(c => {
                const idx = visible.findIndex(v => v.date === c.date);
                if (idx < 0) return null;
                const pct = (c.close - cBase) / cBase;
                const x = idx * slotW + slotW / 2;
                const y = scaleY(mainBase * (1 + pct), pMin, pMax, innerH);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              }).filter(Boolean) as string[];
              if (pts.length < 2) return null;
              return <polyline key={e.ticker} points={pts.join(' ')} fill="none" stroke={e.color} strokeWidth={1.5} strokeOpacity={0.85} />;
            });
          })()}
        </svg>
      )}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 14, backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <div style={{ color: 'var(--color-muted)', marginBottom: 4, fontWeight: 600 }}>{tooltip.candle.date}</div>
          {([['O', tooltip.candle.open], ['H', tooltip.candle.high], ['L', tooltip.candle.low], ['C', tooltip.candle.close]] as [string, number][]).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '1px 0' }}>
              <span style={{ color: 'var(--color-muted)' }}>{key}</span>
              <span style={{ fontWeight: 700 }}>{formatPrice(val)}</span>
            </div>
          ))}
          {(() => {
            const ch = tooltip.candle.close - tooltip.candle.open;
            const pct = tooltip.candle.open !== 0 ? (ch / tooltip.candle.open) * 100 : 0;
            const up = ch >= 0;
            return <div style={{ textAlign: 'right', marginTop: 4, fontWeight: 700, color: up ? 'var(--color-up)' : 'var(--color-down)' }}>{up ? '+' : ''}{ch.toFixed(0)} ({up ? '+' : ''}{pct.toFixed(2)}%)</div>;
          })()}
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.82)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 'min(1280px, 96vw)', height: 'min(680px, 90vh)', backgroundColor: 'var(--color-bg)', borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

// ── CandleChart4: 3+1 레이아웃 ────────────────────────────────
export default function CandleChart4({ ticker }: { ticker: string }) {
  const [expanded, setExpanded] = useState<QuadKey | null>(null);
  const [compareList, setCompareList] = useState<CompareEntry[]>([]);

  useEffect(() => {
    setCompareList(getCompareList());
    function onCompare() { setCompareList(getCompareList()); }
    window.addEventListener(COMPARE_EVENT, onCompare);
    return () => window.removeEventListener(COMPARE_EVENT, onCompare);
  }, []);

  const QUAD_TITLES: Record<QuadKey, string> = {
    q1: '금일 5분봉 (실시간)',
    q2: '시간대별 평균 수익률',
    q3: '요일별 평균 수익률 (90일)',
    q4: '일봉 캔들 차트',
  };

  const topCell = (last: boolean): CSSProperties => ({
    overflow: 'hidden',
    backgroundColor: 'var(--color-surface)',
    position: 'relative',
    borderRight: last ? undefined : '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
  });

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: `${QUAD_H}px ${DAILY_H}px`,
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {/* Top row: 3 charts */}
        <div style={topCell(false)}>
          <IntradayLineChart ticker={ticker} compareList={compareList} onExpand={() => setExpanded('q1')} />
        </div>
        <div style={topCell(false)}>
          <HourlyPatternChart ticker={ticker} compareList={compareList} onExpand={() => setExpanded('q2')} />
        </div>
        <div style={topCell(true)}>
          <WeekdayPatternChart ticker={ticker} compareList={compareList} onExpand={() => setExpanded('q3')} />
        </div>
        {/* Bottom row: daily chart full width */}
        <div style={{ overflow: 'hidden', backgroundColor: 'var(--color-surface)', position: 'relative', gridColumn: '1 / -1' }}>
          <DailyCandleChart ticker={ticker} compareList={compareList} onExpand={() => setExpanded('q4')} />
        </div>
      </div>

      {expanded && (
        <Modal onClose={() => setExpanded(null)} title={QUAD_TITLES[expanded]}>
          {expanded === 'q1' && <IntradayLineChart ticker={ticker} compareList={compareList} height={MODAL_CHART_H} />}
          {expanded === 'q2' && <HourlyPatternChart ticker={ticker} compareList={compareList} height={MODAL_CHART_H} />}
          {expanded === 'q3' && <WeekdayPatternChart ticker={ticker} compareList={compareList} height={MODAL_CHART_H} />}
          {expanded === 'q4' && <DailyCandleChart ticker={ticker} compareList={compareList} height={MODAL_CHART_H} />}
        </Modal>
      )}
    </>
  );
}
