'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCompareList, removeFromCompare, isInCompare, toggleCompare,
  type CompareEntry, COMPARE_EVENT,
} from '@/lib/compare-stocks';
import { Tooltip } from './Tooltip';
import { TOOLTIPS } from '@/lib/tooltips';

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3002';

const COLOR_UP   = '#f85149';
const COLOR_DOWN = '#58a6ff';

type PriceData = Record<string, unknown> | null;

function readPersonaCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )st_persona=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function CompareBar({
  persona,
  ticker,
  stockName,
  stockMarket,
}: {
  persona: string;
  ticker: string;
  stockName: string | null;
  stockMarket: string;
}) {
  const [livePersona, setLivePersona] = useState(persona);
  const [list, setList] = useState<CompareEntry[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [inCompare, setInCompare] = useState(false);

  const refresh = useCallback(() => {
    setList(getCompareList());
    setInCompare(isInCompare(ticker));
  }, [ticker]);

  // persona sync — cookie read on mount + event from Sidebar
  useEffect(() => {
    const cookie = readPersonaCookie();
    if (cookie) setLivePersona(cookie);
    function onPersonaChange(e: Event) {
      setLivePersona((e as CustomEvent<string>).detail);
    }
    window.addEventListener('st_persona_change', onPersonaChange);
    return () => window.removeEventListener('st_persona_change', onPersonaChange);
  }, []);

  // compare list sync
  useEffect(() => {
    refresh();
    window.addEventListener(COMPARE_EVENT, refresh);
    return () => window.removeEventListener(COMPARE_EVENT, refresh);
  }, [refresh]);

  // 비교종목 현재가/변동률
  useEffect(() => {
    if (list.length === 0) return;
    let cancelled = false;
    Promise.allSettled(
      list.map(e =>
        fetch(`${BFF}/api/price/${e.ticker}`, { signal: AbortSignal.timeout(3000) })
          .then(r => r.ok ? r.json() as Promise<PriceData> : null)
          .catch(() => null)
          .then(d => [e.ticker, d] as const)
      )
    ).then(results => {
      if (cancelled) return;
      const map: Record<string, PriceData> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') map[r.value[0]] = r.value[1];
      }
      setPrices(map);
    });
    return () => { cancelled = true; };
  }, [list]);

  function handleToggle() {
    toggleCompare(ticker, stockName ?? ticker);
    setInCompare(isInCompare(ticker));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Row 1: 페르소나 | 구분자 | ☑ ticker 종목명 KOSPI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11,
          color: 'var(--color-muted)', border: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          {livePersona}
        </span>
        <span style={{ color: 'var(--color-border)', userSelect: 'none', fontSize: 12, flexShrink: 0 }}>|</span>
        <input
          type="checkbox"
          checked={inCompare}
          onChange={handleToggle}
          title="비교종목 추가/삭제"
          style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', width: 14, height: 14, flexShrink: 0 }}
        />
        <h1 className="mono" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
          {ticker}
        </h1>
        {stockName != null && (
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', flexShrink: 0 }}>
            {stockName}
          </span>
        )}
        <Tooltip title={stockMarket} content={TOOLTIPS.misc.kospi}>
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
            backgroundColor: stockMarket === 'KOSDAQ' ? 'rgba(63,185,80,0.12)' : 'rgba(88,166,255,0.12)',
            color: stockMarket === 'KOSDAQ' ? 'var(--color-up)' : 'var(--color-accent)',
            border: stockMarket === 'KOSDAQ' ? '1px solid rgba(63,185,80,0.25)' : '1px solid rgba(88,166,255,0.25)',
            cursor: 'help', flexShrink: 0,
          }}>
            {stockMarket}
          </span>
        </Tooltip>
      </div>

      {/* Row 2: 비교종목 칩 */}
      {list.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap' }}>
          {list.map(e => {
            const d = prices[e.ticker];
            const changePct = typeof d?.change_pct === 'number' ? (d.change_pct as number) : null;
            const change    = typeof d?.change    === 'number' ? (d.change    as number) : null;
            const direction = changePct != null ? (changePct > 0 ? 'up' : changePct < 0 ? 'down' : null)
                            : change    != null ? (change > 0    ? 'up' : change < 0    ? 'down' : null)
                            : null;
            const textColor = direction === 'up' ? COLOR_UP : direction === 'down' ? COLOR_DOWN : 'var(--color-text)';

            return (
              <div
                key={e.ticker}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                  border: `1px solid ${e.color}66`,
                  backgroundColor: e.ticker === ticker ? `${e.color}18` : 'transparent',
                  cursor: 'default', flexShrink: 0,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: e.color, flexShrink: 0 }} />
                <span className="mono" style={{ color: textColor, fontWeight: 600 }}>{e.ticker}</span>
                {e.name && (
                  <span style={{ color: textColor, opacity: 0.8, fontSize: 10 }}>{e.name}</span>
                )}
                <button
                  onClick={() => removeFromCompare(e.ticker)}
                  title="비교 제거"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-muted)', fontSize: 14, padding: 0,
                    lineHeight: 1, marginLeft: 2,
                  }}
                >×</button>
              </div>
            );
          })}
          <span style={{ fontSize: 10, color: 'var(--color-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            종목비교목록 배열(추가순)
          </span>
        </div>
      )}
    </div>
  );
}
