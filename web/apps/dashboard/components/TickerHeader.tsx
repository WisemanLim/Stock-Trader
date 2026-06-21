'use client';

import { useState, useEffect } from 'react';
import { isInCompare, toggleCompare, COMPARE_EVENT } from '@/lib/compare-stocks';
import { Tooltip } from './Tooltip';
import { TOOLTIPS } from '@/lib/tooltips';

export default function TickerHeader({
  ticker,
  stockName,
  stockMarket,
}: {
  ticker: string;
  stockName: string | null;
  stockMarket: string;
}) {
  const [inCompare, setInCompare] = useState(false);

  useEffect(() => {
    setInCompare(isInCompare(ticker));
    function sync() { setInCompare(isInCompare(ticker)); }
    window.addEventListener(COMPARE_EVENT, sync);
    return () => window.removeEventListener(COMPARE_EVENT, sync);
  }, [ticker]);

  function handleToggle() {
    toggleCompare(ticker, stockName ?? ticker);
    setInCompare(isInCompare(ticker));
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="checkbox"
        checked={inCompare}
        onChange={handleToggle}
        title="비교종목 추가/삭제"
        style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', width: 14, height: 14, flexShrink: 0 }}
      />
      <h1
        className="mono"
        style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}
      >
        {ticker}
      </h1>
      {stockName != null && (
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)' }}>
          {stockName}
        </span>
      )}
      <Tooltip title={stockMarket} content={TOOLTIPS.misc.kospi}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            backgroundColor: stockMarket === 'KOSDAQ'
              ? 'rgba(63,185,80,0.12)' : 'rgba(88,166,255,0.12)',
            color: stockMarket === 'KOSDAQ'
              ? 'var(--color-up)' : 'var(--color-accent)',
            border: stockMarket === 'KOSDAQ'
              ? '1px solid rgba(63,185,80,0.25)' : '1px solid rgba(88,166,255,0.25)',
            cursor: 'help',
          }}
        >
          {stockMarket}
        </span>
      </Tooltip>
    </div>
  );
}
