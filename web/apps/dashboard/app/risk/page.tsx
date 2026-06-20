'use client';
import { useEffect, useState } from 'react';
import { searchStocks } from '@/lib/stocks';
import { Tooltip } from '@/components/Tooltip';
import { TOOLTIPS } from '@/lib/tooltips';

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002';

type Alert = { ticker?: string; alert_type?: string; market?: string; short_ratio?: number; short_volume?: number; alert_date?: string };
type ShortRow = { date?: string; short_volume?: number; short_ratio?: number; close?: number };
type Fundamental = {
  ticker: string; name?: string | null; per?: number | null; pbr?: number | null;
  eps?: number | null; roe?: number | null; revenue?: number | null;
  operating_profit?: number | null; net_income?: number | null;
  debt_ratio?: number | null; dividend_yield?: number | null; market?: string | null;
};
type Indicators = {
  rsi?: number | null; ma_5?: number | null; ma_20?: number | null;
  ma_death_cross?: boolean; volume_collapse?: boolean; close?: number;
  sma_50?: number | null; ema_20?: number | null;
};
type RiskResult = { action: string; reason: string; triggered: string[] };

const alertColor = (type?: string) => {
  if (!type) return 'var(--color-muted)';
  const t = type.toUpperCase();
  if (t.includes('위험') || t.includes('DANGER') || t.includes('HALT')) return 'var(--color-down)';
  if (t.includes('경고') || t.includes('WARN')) return '#f0a500';
  return 'var(--color-accent)';
};

const actionColor = (action?: string) => {
  if (!action) return 'var(--color-muted)';
  const a = action.toLowerCase();
  if (a.includes('force_sell') || a.includes('block_buy')) return 'var(--color-down)';
  if (a.includes('reduce')) return '#f0a500';
  return 'var(--color-up)';
};

const actionLabel = (action?: string) => {
  const map: Record<string, string> = {
    hold: '✅ HOLD', block_buy: '🚫 매수 차단', reduce_position: '⚠️ 비중 축소',
    force_sell: '🔴 강제 매도', take_profit: '💰 익절',
  };
  return map[action ?? ''] ?? action ?? '-';
};

function fmt(v: number | null | undefined, unit = '') {
  if (v == null) return '-';
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + unit;
}
function fmtOk(v: number | null | undefined, unit = '') {
  if (v == null) return '-';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (unit === '억') {
    const raw = sign + abs.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '억원';
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1).replace(/\.0$/, '')}경 (${raw})`;
    if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1).replace(/\.0$/, '')}조 (${raw})`;
    return raw;
  }
  if (abs >= 10000) return sign + (abs / 10000).toFixed(0) + '만' + unit;
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + unit;
}

// Inline SVG gauge bar: value / max, with optional threshold line
function GaugeBar({ value, max, threshold, low, reverse = false, width = 200, height = 16 }:
  { value: number | null | undefined; max: number; threshold?: number; low?: number; reverse?: boolean; width?: number; height?: number }) {
  if (value == null) return <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>-</span>;
  const pct = Math.min(value / max, 1);
  const fillColor = reverse
    ? (value <= (low ?? max * 0.3) ? 'var(--color-up)' : value >= max ? 'var(--color-down)' : '#f0a500')
    : (threshold && value >= threshold ? 'var(--color-down)' : low && value <= low ? 'var(--color-up)' : '#58a6ff');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <rect x={0} y={4} width={width} height={height - 8} rx={3} fill="var(--color-border)" />
      <rect x={0} y={4} width={pct * width} height={height - 8} rx={3} fill={fillColor} />
      {threshold && threshold <= max && (
        <line x1={threshold / max * width} y1={0} x2={threshold / max * width} y2={height} stroke="var(--color-down)" strokeWidth={1.5} strokeDasharray="2,2" />
      )}
      {low && low <= max && (
        <line x1={low / max * width} y1={0} x2={low / max * width} y2={height} stroke="var(--color-up)" strokeWidth={1.5} strokeDasharray="2,2" />
      )}
    </svg>
  );
}

// RSI zone gauge (0-100)
function RsiGauge({ rsi, width = 240 }: { rsi: number | null | undefined; width?: number }) {
  const h = 24;
  if (rsi == null) return <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>-</span>;
  const x = (rsi / 100) * width;
  return (
    <svg width={width} height={h + 14} style={{ display: 'block', overflow: 'visible' }}>
      {/* oversold zone 0-30 */}
      <rect x={0} y={4} width={width * 0.3} height={h - 8} fill="rgba(63,185,80,0.25)" rx={3} />
      {/* neutral zone 30-70 */}
      <rect x={width * 0.3} y={4} width={width * 0.4} height={h - 8} fill="rgba(88,166,255,0.15)" />
      {/* overbought zone 70-100 */}
      <rect x={width * 0.7} y={4} width={width * 0.3} height={h - 8} fill="rgba(248,81,73,0.25)" rx={3} />
      {/* zone labels */}
      <text x={width * 0.15} y={h + 12} textAnchor="middle" fontSize={9} fill="var(--color-up)">과매도</text>
      <text x={width * 0.5} y={h + 12} textAnchor="middle" fontSize={9} fill="var(--color-muted)">중립</text>
      <text x={width * 0.85} y={h + 12} textAnchor="middle" fontSize={9} fill="var(--color-down)">과매수</text>
      {/* threshold lines */}
      <line x1={width * 0.3} y1={2} x2={width * 0.3} y2={h + 2} stroke="var(--color-up)" strokeWidth={1} strokeDasharray="2,2" />
      <line x1={width * 0.7} y1={2} x2={width * 0.7} y2={h + 2} stroke="var(--color-down)" strokeWidth={1} strokeDasharray="2,2" />
      {/* current value indicator */}
      <polygon points={`${x},${h - 2} ${x - 4},${h + 4} ${x + 4},${h + 4}`} fill={rsi > 70 ? 'var(--color-down)' : rsi < 30 ? 'var(--color-up)' : 'var(--color-accent)'} />
      <line x1={x} y1={0} x2={x} y2={h} stroke={rsi > 70 ? 'var(--color-down)' : rsi < 30 ? 'var(--color-up)' : 'var(--color-accent)'} strokeWidth={2} />
    </svg>
  );
}

// MA comparison bar
function MaBar({ ma5, ma20, width = 240 }: { ma5: number | null | undefined; ma20: number | null | undefined; width?: number }) {
  if (!ma5 || !ma20) return <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>-</span>;
  const min = Math.min(ma5, ma20) * 0.995;
  const max = Math.max(ma5, ma20) * 1.005;
  const range = max - min;
  const x5 = ((ma5 - min) / range) * width;
  const x20 = ((ma20 - min) / range) * width;
  const deathCross = ma5 < ma20;
  return (
    <svg width={width} height={28} style={{ display: 'block', overflow: 'visible' }}>
      <rect x={0} y={10} width={width} height={8} rx={3} fill="var(--color-border)" />
      {/* MA20 marker */}
      <line x1={x20} y1={6} x2={x20} y2={22} stroke="#f0a500" strokeWidth={2} />
      <text x={x20} y={4} textAnchor="middle" fontSize={9} fill="#f0a500">MA20</text>
      {/* MA5 marker */}
      <line x1={x5} y1={6} x2={x5} y2={22} stroke={deathCross ? 'var(--color-down)' : 'var(--color-up)'} strokeWidth={2} />
      <text x={x5} y={28} textAnchor="middle" fontSize={9} fill={deathCross ? 'var(--color-down)' : 'var(--color-up)'}>MA5</text>
    </svg>
  );
}

// Module-level cache
let _rCacheTicker = '';
let _rCacheAlerts: Alert[] = [];
let _rCacheShortRows: ShortRow[] = [];
let _rCacheFund: Fundamental | null = null;
let _rCacheInd: Indicators | null = null;
let _rCacheRisk: RiskResult | null = null;

export default function RiskPage() {
  const [alerts, setAlerts] = useState<Alert[]>(_rCacheAlerts);
  const [shortRows, setShortRows] = useState<ShortRow[]>(_rCacheShortRows);
  const [fundamental, setFundamental] = useState<Fundamental | null>(_rCacheFund);
  const [indicators, setIndicators] = useState<Indicators | null>(_rCacheInd);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(_rCacheRisk);
  const [ticker, setTicker] = useState(_rCacheTicker || '005930');
  const [stockName, setStockName] = useState('');
  const [inputTicker, setInputTicker] = useState(_rCacheTicker || '005930');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function resolveName(t: string): Promise<string> {
    const local = searchStocks(t, 1).find(s => s.ticker === t);
    if (local) return local.name;
    try {
      const r = await fetch(`${BFF}/api/stocks/${t}`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) { const d = await r.json(); if (d?.name) return d.name as string; }
    } catch { /* ignore */ }
    return '';
  }

  useEffect(() => {
    const saved = localStorage.getItem('st_ticker') ?? '005930';
    const savedName = localStorage.getItem('st_name') ?? '';
    setTicker(saved);
    setInputTicker(saved);
    const local = searchStocks(saved, 1).find(s => s.ticker === saved);
    setStockName(local?.name ?? savedName);
    if (!local) resolveName(saved).then(n => { if (n) setStockName(n); });
    if (_rCacheTicker === saved && (_rCacheAlerts.length > 0 || _rCacheFund)) {
      setAlerts(_rCacheAlerts); setShortRows(_rCacheShortRows);
      setFundamental(_rCacheFund); setIndicators(_rCacheInd); setRiskResult(_rCacheRisk);
    } else {
      load(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(t: string) {
    setLoading(true); setErr('');
    try {
      const [alertsRes, shortRes, fundRes, indRes] = await Promise.allSettled([
        fetch(`${BFF}/api/market-alerts?ticker=${encodeURIComponent(t)}`).then(r => r.json()),
        fetch(`${BFF}/api/short-selling/${encodeURIComponent(t)}`).then(r => r.json()),
        fetch(`${BFF}/api/fundamental/${encodeURIComponent(t)}`).then(r => r.json()),
        fetch(`${BFF}/api/indicators/${encodeURIComponent(t)}`).then(r => r.json()),
      ]);

      const newAlerts = alertsRes.status === 'fulfilled'
        ? (Array.isArray(alertsRes.value) ? alertsRes.value : (alertsRes.value?.alerts ?? alertsRes.value?.data ?? []))
        : [];
      const newShortRows = shortRes.status === 'fulfilled'
        ? (Array.isArray(shortRes.value) ? shortRes.value : (shortRes.value?.rows ?? shortRes.value?.data ?? []))
        : [];
      const newFund: Fundamental | null = fundRes.status === 'fulfilled' ? fundRes.value : null;
      const newInd: Indicators | null = indRes.status === 'fulfilled' ? indRes.value : null;

      // POST risk/check with fetched data
      let newRisk: RiskResult | null = null;
      if (newFund && newInd) {
        try {
          const priceRes = await fetch(`${BFF}/api/price/${encodeURIComponent(t)}`).then(r => r.json());
          const currentPrice = priceRes?.close ?? priceRes?.price ?? newInd.close ?? 0;
          const riskBody = {
            ticker: t,
            entry_price: currentPrice,
            current_price: currentPrice,
            stop_loss_pct: 0.02,
            daily_loss_limit_pct: 0.05,
            max_position_pct: 0.1,
            per: newFund.per ?? 0, per_max: 30,
            pbr: newFund.pbr ?? 0, pbr_max: 3.0,
            roe: newFund.roe ?? 0, roe_min: 5.0,
            debt_ratio: newFund.debt_ratio ?? 0, debt_ratio_max: 200,
            rsi: newInd.rsi ?? 0, rsi_overbought: 80,
            ma_death_cross: newInd.ma_death_cross ?? false,
            volume_collapse: newInd.volume_collapse ?? false,
          };
          const rr = await fetch(`${BFF}/api/risk/check`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(riskBody),
          }).then(r => r.json());
          newRisk = rr as RiskResult;
        } catch { /* ignore */ }
      }

      _rCacheTicker = t;
      _rCacheAlerts = newAlerts; _rCacheShortRows = newShortRows;
      _rCacheFund = newFund; _rCacheInd = newInd; _rCacheRisk = newRisk;
      setAlerts(newAlerts); setShortRows(newShortRows);
      setFundamental(newFund); setIndicators(newInd); setRiskResult(newRisk);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    const t = inputTicker.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    const local = searchStocks(t, 1).find(s => s.ticker === t);
    setStockName(local?.name ?? '');
    if (!local) resolveName(t).then(n => { if (n) setStockName(n); });
    load(t);
  }

  const cs = { padding: '10px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 13 } as const;
  const card = { backgroundColor: 'var(--color-card)', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>⚠ 리스크 모니터</h2>
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: 'rgba(88,166,255,0.12)', color: 'var(--color-accent)' }}>Phase B</span>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, padding: 14, ...card, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          종목코드
          <input value={inputTicker} onChange={e => setInputTicker(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="005930"
            style={{ width: 100, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'monospace' }} />
        </label>
        <button onClick={handleSearch} disabled={loading}
          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', backgroundColor: 'var(--color-accent)', color: '#fff', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '로딩…' : '조회'}
        </button>
        {ticker && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{ticker}</span>
            {stockName && <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{stockName}</span>}
            {fundamental?.market && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: 'rgba(88,166,255,0.12)', color: 'var(--color-accent)' }}>{fundamental.market}</span>}
          </div>
        )}
      </div>

      {err && <div style={{ color: 'var(--color-down)', fontSize: 12 }}>⚠ {err}</div>}

      {/* Risk Assessment Summary */}
      {riskResult && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}><Tooltip title="종합 리스크 평가" content={TOOLTIPS.fundamental.riskSummary}>종합 리스크 평가</Tooltip></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: actionColor(riskResult.action) }}>
              {actionLabel(riskResult.action)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1 }}>{riskResult.reason}</span>
            {riskResult.triggered?.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {riskResult.triggered.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, backgroundColor: 'rgba(248,81,73,0.15)', color: 'var(--color-down)', fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fundamental Charts */}
      <div style={card}>
        <div style={cs}>펀더멘털 지표 <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>Naver Finance + Yahoo Finance</span></div>
        {!fundamental ? (
          <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--color-muted)' }}>{loading ? '로딩 중…' : '데이터 없음'}</div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
            {/* PER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="PER" content={TOOLTIPS.fundamental.per}>PER</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>주가수익비율</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.per ?? 0) > 30 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmt(fundamental.per, 'x')}</span>
              </div>
              <GaugeBar value={fundamental.per} max={60} threshold={30} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted)' }}><span>0</span><span style={{ color: 'var(--color-down)' }}>한도 30x</span><span>60x</span></div>
            </div>
            {/* PBR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="PBR" content={TOOLTIPS.fundamental.pbr}>PBR</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>주가순자산비율</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.pbr ?? 0) > 3 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmt(fundamental.pbr, 'x')}</span>
              </div>
              <GaugeBar value={fundamental.pbr} max={8} threshold={3} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted)' }}><span>0</span><span style={{ color: 'var(--color-down)' }}>한도 3x</span><span>8x</span></div>
            </div>
            {/* ROE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="ROE" content={TOOLTIPS.fundamental.roe}>ROE</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>자기자본수익률</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.roe ?? 0) >= 5 ? 'var(--color-up)' : 'var(--color-down)' }}>{fmt(fundamental.roe, '%')}</span>
              </div>
              <GaugeBar value={fundamental.roe} max={40} low={5} reverse />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted)' }}><span>0%</span><span style={{ color: 'var(--color-up)' }}>최소 5%</span><span>40%</span></div>
            </div>
            {/* 부채비율 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="부채비율" content={TOOLTIPS.fundamental.debtRatio}>부채비율</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>총부채/자기자본</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.debt_ratio ?? 0) > 200 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmt(fundamental.debt_ratio, '%')}</span>
              </div>
              <GaugeBar value={fundamental.debt_ratio} max={400} threshold={200} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted)' }}><span>0%</span><span style={{ color: 'var(--color-down)' }}>한도 200%</span><span>400%</span></div>
            </div>
            {/* EPS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="EPS" content={TOOLTIPS.fundamental.eps}>EPS</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>주당순이익</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.eps ?? 0) < 0 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmt(fundamental.eps, '원')}</span>
              </div>
              <div style={{ fontSize: 11, color: (fundamental.eps ?? 0) < 0 ? 'var(--color-down)' : 'var(--color-muted)' }}>
                {(fundamental.eps ?? 0) < 0 ? '⚠ 적자 기업 (EPS 음수)' : '당기순이익 ÷ 발행주식수'}
              </div>
            </div>
            {/* 매출액 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="매출액" content={TOOLTIPS.fundamental.revenue}>매출액</Tooltip></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtOk(fundamental.revenue, '억')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>회사 총 판매 수익 (연간)</div>
            </div>
            {/* 영업이익 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="영업이익" content={TOOLTIPS.fundamental.operatingProfit}>영업이익</Tooltip></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.operating_profit ?? 0) < 0 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmtOk(fundamental.operating_profit, '억')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>매출 − 원가 − 판관비 (본업수익)</div>
            </div>
            {/* 당기순이익 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="당기순이익" content={TOOLTIPS.fundamental.netIncome}>당기순이익</Tooltip></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (fundamental.net_income ?? 0) < 0 ? 'var(--color-down)' : 'var(--color-text)' }}>{fmtOk(fundamental.net_income, '억')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>세후 최종 이익</div>
            </div>
          </div>
        )}
      </div>

      {/* Technical Charts */}
      {indicators && (
        <div style={card}>
          <div style={cs}>기술 지표 <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>이동평균선 · RSI · 거래량</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
            {/* RSI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="RSI(14)" content={TOOLTIPS.indicator.rsi}>RSI(14)</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>상대강도지수</span></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (indicators.rsi ?? 50) > 70 ? 'var(--color-down)' : (indicators.rsi ?? 50) < 30 ? 'var(--color-up)' : 'var(--color-text)' }}>
                  {fmt(indicators.rsi)}
                </span>
              </div>
              <RsiGauge rsi={indicators.rsi} width={240} />
            </div>
            {/* MA 이동평균선 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="이동평균선" content={TOOLTIPS.fundamental.maCross}>이동평균선</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>MA5 vs MA20</span></span>
                {indicators.ma_death_cross
                  ? <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: 'rgba(248,81,73,0.15)', color: 'var(--color-down)', fontWeight: 600 }}>⬇ 데드크로스</span>
                  : <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: 'rgba(63,185,80,0.15)', color: 'var(--color-up)', fontWeight: 600 }}>⬆ 골든크로스</span>
                }
              </div>
              <MaBar ma5={indicators.ma_5} ma20={indicators.ma_20} width={240} />
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-muted)' }}>
                <span>MA5 <b style={{ color: indicators.ma_death_cross ? 'var(--color-down)' : 'var(--color-up)', fontFamily: 'monospace' }}>{fmt(indicators.ma_5)}</b></span>
                <span>MA20 <b style={{ color: '#f0a500', fontFamily: 'monospace' }}>{fmt(indicators.ma_20)}</b></span>
              </div>
            </div>
            {/* 거래량 상태 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}><Tooltip title="거래량 상태" content={TOOLTIPS.fundamental.volumeCollapse}>거래량 상태</Tooltip> <span style={{ fontWeight: 400, color: 'var(--color-muted)', fontSize: 10 }}>20일 평균 대비</span></span>
                {indicators.volume_collapse
                  ? <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: 'rgba(248,81,73,0.15)', color: 'var(--color-down)', fontWeight: 600 }}>⚠ 거래량 급감</span>
                  : <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: 'rgba(63,185,80,0.15)', color: 'var(--color-up)', fontWeight: 600 }}>✓ 정상</span>
                }
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {indicators.volume_collapse ? '당일 거래량 < 20일 평균의 30% — 유동성 주의' : '당일 거래량 정상 범위'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market alerts */}
      <div style={card}>
        <div style={cs}>시장경보 {alerts.length > 0 && <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>{alerts.length}건</span>}</div>
        {alerts.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--color-muted)' }}>{loading ? '로딩 중…' : '경보 없음'}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                {['종목', '경보유형', '마켓', '공매도비율', '날짜'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{a.ticker ?? '-'}</td>
                  <td style={{ padding: '6px 12px' }}><span style={{ color: alertColor(a.alert_type), fontWeight: 600 }}>{a.alert_type ?? '-'}</span></td>
                  <td style={{ padding: '6px 12px', color: 'var(--color-muted)' }}>{a.market ?? '-'}</td>
                  <td style={{ padding: '6px 12px' }}>{a.short_ratio != null ? (a.short_ratio * 100).toFixed(2) + '%' : '-'}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--color-muted)' }}>{a.alert_date ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Short selling */}
      <div style={card}>
        <div style={cs}>공매도 추이 <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>{ticker}{stockName ? ` · ${stockName}` : ''}{shortRows.length > 0 ? ` · ${shortRows.length}일` : ''}</span></div>
        {shortRows.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--color-muted)' }}>{loading ? '로딩 중…' : '공매도 데이터 없음'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                  {['날짜', '공매도수량', '공매도비율', '종가'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shortRows.slice(0, 30).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 12px', color: 'var(--color-muted)' }}>{row.date ?? '-'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{row.short_volume?.toLocaleString('ko-KR') ?? '-'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: (row.short_ratio ?? 0) > 0.2 ? 'var(--color-down)' : (row.short_ratio ?? 0) > 0.1 ? '#f0a500' : 'var(--color-text)' }}>
                      {row.short_ratio != null ? (row.short_ratio * 100).toFixed(2) + '%' : '-'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{row.close?.toLocaleString('ko-KR') ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
