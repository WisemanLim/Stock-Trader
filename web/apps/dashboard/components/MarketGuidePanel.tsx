'use client';
import { useState } from 'react';

/**
 * 우측 floating 투자 참고 패널 — 대시보드·포트폴리오 공용.
 * 탭 3종: 캔들 패턴 · 상승 주도주(테마) · 업종 대장주.
 * 모든 데이터는 첨부 인포그래픽 기반 교육용 — 투자 권유 아님.
 * 색상: 한국 관례(상승=적색 var(--color-up), 하락=청색 var(--color-down)).
 */

const UP = 'var(--color-up)';
const DOWN = 'var(--color-down)';
const PANEL_W = 340;
const TAB_W = 30;

/* ─────────────── 1) 캔들 패턴 ─────────────── */
type Signal = 'buy' | 'sell' | 'neutral';
type Glyph = 'hammer' | 'engulfing' | 'invHammer' | 'shootingStar' | 'doji';
type Pattern = { name: string; en: string; tag: string; signal: Signal; desc: string; glyph: Glyph };

const PATTERNS: Pattern[] = [
  { name: '망치형',   en: 'Hammer',            tag: '반등 신호',      signal: 'buy',     glyph: 'hammer',       desc: '하락 후 나타나면 반등 가능성. 긴 아래꼬리로 매도세를 매수세가 밀어내는 형태.' },
  { name: '장악형',   en: 'Bullish Engulfing', tag: '강한 상승 전환', signal: 'buy',     glyph: 'engulfing',    desc: '음봉 다음 큰 양봉이 이전 캔들을 완전히 덮음. 강한 상승 전환 신호.' },
  { name: '역망치형', en: 'Inverted Hammer',   tag: '상승 가능성',    signal: 'buy',     glyph: 'invHammer',    desc: '바닥권에서 나오면 상승 가능성. 긴 위꼬리가 특징.' },
  { name: '유성형',   en: 'Shooting Star',     tag: '하락 경고',      signal: 'sell',    glyph: 'shootingStar', desc: '상승 후 출현 시 하락 가능성. 긴 위꼬리로 매수세가 힘을 잃은 형태.' },
  { name: '도지형',   en: 'Doji',              tag: '방향성 고민',    signal: 'neutral', glyph: 'doji',         desc: '시가와 종가가 거의 동일. 방향성 결정 전 힘겨루기.' },
];
const COMBOS = ['망치형 + 거래량 증가', '장악형 + 20일선 돌파', '역망치형 + 바닥권 출현'];

function candle(x: number, bodyTop: number, bodyBot: number, wickTop: number, wickBot: number, color: string, w = 10) {
  return (
    <g>
      <line x1={x} y1={wickTop} x2={x} y2={wickBot} stroke={color} strokeWidth={1.5} />
      <rect x={x - w / 2} y={bodyTop} width={w} height={Math.max(2, bodyBot - bodyTop)} fill={color} />
    </g>
  );
}
function PatternGlyph({ glyph }: { glyph: Glyph }) {
  let body: React.ReactNode;
  switch (glyph) {
    case 'hammer':       body = candle(26, 12, 24, 9, 54, UP); break;
    case 'invHammer':    body = candle(26, 40, 52, 10, 55, UP); break;
    case 'shootingStar': body = candle(26, 40, 52, 10, 55, DOWN); break;
    case 'doji':         body = (<g>{candle(26, 31, 33, 10, 54, 'var(--color-muted)')}<line x1={16} y1={32} x2={36} y2={32} stroke="var(--color-muted)" strokeWidth={1.5} /></g>); break;
    case 'engulfing':    body = (<>{candle(17, 26, 36, 22, 40, DOWN, 8)}{candle(35, 16, 48, 12, 52, UP, 13)}</>); break;
  }
  return <svg width={52} height={64} style={{ flexShrink: 0 }}>{body}</svg>;
}
const SIGNAL_META: Record<Signal, { label: string; color: string; arrow: string }> = {
  buy:     { label: '매수', color: UP,                   arrow: '▲' },
  sell:    { label: '매도', color: DOWN,                 arrow: '▼' },
  neutral: { label: '관망', color: 'var(--color-muted)', arrow: '◆' },
};

function CandleTab() {
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8 }}>
        대표 패턴 5종 · <span style={{ color: UP }}>적색=상승</span> · <span style={{ color: DOWN }}>청색=하락</span>
      </div>
      {PATTERNS.map(p => {
        const s = SIGNAL_META[p.signal];
        return (
          <div key={p.name} style={{ display: 'flex', gap: 10, background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 2, display: 'flex', alignItems: 'center' }}>
              <PatternGlyph glyph={p.glyph} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: s.color, background: 'var(--color-bg)', border: `1px solid ${s.color}`, borderRadius: 4, padding: '1px 6px' }}>{s.arrow} {s.label}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', margin: '1px 0 4px' }}>{p.en} · {p.tag}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.45 }}>{p.desc}</div>
            </div>
          </div>
        );
      })}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: UP }}>📈 상승 확률 높은 조합 TOP 3</div>
        {COMBOS.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, padding: '3px 0', color: 'var(--color-text)' }}>
            <span style={{ fontWeight: 700, color: UP }}>{i + 1}</span>{c}
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(210,153,34,0.10)', border: '1px solid rgba(210,153,34,0.4)', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warn)', marginBottom: 4 }}>⚠ 캔들만 믿지 말 것</div>
        <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5 }}>
          캔들 정확도는 <b>55~70%</b> 수준. 거래량 · 이동평균선 · 지지/저항 · 시장 분위기 · 기업 실적 등을 <b>종합 분석</b>할 때 승률이 높아집니다.
        </div>
      </div>
    </>
  );
}

/* ─────────────── 2) 상승 주도주(테마) ─────────────── */
type Theme = { no: string; theme: string; period: string; leads: { name: string; mult: string }[]; etfs: string[] };
const THEMES: Theme[] = [
  { no: '01', theme: '반도체',    period: "'26.1~10월", leads: [{ name: 'SK하이닉스', mult: '3.2배' }], etfs: ['TIGER 반도체 TOP10', 'HANARO Fn K-반도체', 'KODEX 반도체'] },
  { no: '02', theme: '로봇',      period: "'26.1~10월", leads: [{ name: '원익홀딩스', mult: '11배' }],   etfs: ['RISE AI&로봇', 'KODEX 로봇테마'] },
  { no: '03', theme: '전력설비',  period: "'26.1~10월", leads: [{ name: '효성중공업', mult: '5.3배' }],  etfs: ['KODEX AI전력핵심설비', 'TIGER AI전력인프라기기TOP3플러스'] },
  { no: '04', theme: '2차전지',   period: "'26.1~10월", leads: [{ name: '에코프로', mult: '1.5배' }],    etfs: ['KODEX 2차전지산업', 'TIGER 2차전지 TOP10', 'TIGER 2차전지 소재Fn'] },
  { no: '05', theme: '원전',      period: "'26.1~10월", leads: [{ name: '두산에너빌리티', mult: '5.2배' }], etfs: ['HANARO 원자력iSelect', 'TIGER 코리아원자력'] },
  { no: '06', theme: '조선/방산', period: "'26.1~10월", leads: [{ name: '한화오션', mult: '3.7배' }, { name: '현대로템', mult: '4.7배' }], etfs: ['SOL 조선TOP3플러스', 'TIGER 조선TOP10', 'PLUS K방산', 'KODEX K방산TOP10'] },
];

const LEADERS: { sector: string; name: string }[] = [
  { sector: 'MLCC',          name: '삼성전기' },        { sector: '전력',          name: 'LS ELECTRIC' },
  { sector: '전선',          name: '가온전선' },        { sector: '건설',          name: '현대건설' },
  { sector: '조선',          name: '두산에너빌리티' },  { sector: '조선',          name: 'HD현대중공업' },
  { sector: '기타지주/부품', name: '한미반도체' },      { sector: '반도체',        name: 'SK하이닉스' },
  { sector: '유리기판',      name: 'SKC' },             { sector: '증권',          name: '미래에셋증권' },
  { sector: '2차전지',       name: '삼성SDI' },         { sector: 'SI/시스템통합', name: '삼성SDS' },
  { sector: '로봇',          name: '레인보우로보틱스' },{ sector: '건설기계',      name: 'HD현대건설기계' },
  { sector: '방산',          name: '한화에어로스페이스' }, { sector: '엔터',       name: 'HYBE' },
  { sector: '화장품',        name: 'APR' },             { sector: '인물주',        name: '카카오·네이버·SOOP' },
];

/** 종목명으로 티커 검색 후 대시보드 매수/매도 화면 이동. */
async function goToStock(name: string) {
  const q = name.split(/[·,]/)[0].trim();
  try {
    const r = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}&limit=1`, { signal: AbortSignal.timeout(3000) });
    const data = await r.json();
    const hit = data?.results?.[0];
    if (!hit?.ticker) { alert(`'${q}' 종목을 찾지 못했습니다.`); return; }
    document.cookie = `st_ticker=${encodeURIComponent(hit.ticker)}; path=/; max-age=2592000`;
    try { localStorage.setItem('st_ticker', hit.ticker); localStorage.setItem('st_name', hit.name ?? q); } catch { /* ignore */ }
    window.location.assign('/');
  } catch {
    alert(`'${q}' 검색 실패 — 잠시 후 다시 시도하세요.`);
  }
}

const stockLink: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 700, fontSize: 13, textAlign: 'left' };

function ThemeTab() {
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8 }}>2026년 1월~10월 상승 기대 6대 테마</div>
      {THEMES.map(t => (
        <div key={t.no} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', background: 'rgba(88,166,255,0.12)', borderRadius: 4, padding: '1px 6px' }}>{t.no}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t.theme}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-muted)' }}>{t.period}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 6 }}>
            {t.leads.map(l => (
              <span key={l.name} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                <button onClick={() => goToStock(l.name)} style={stockLink}>{l.name}</button>
                <span style={{ fontSize: 12, fontWeight: 700, color: UP }}>{l.mult}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {t.etfs.map(e => (
              <span key={e} style={{ fontSize: 10, color: 'var(--color-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px' }}>ETF {e}</span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function LeaderTab() {
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8 }}>업종별 대표 대장주 (클릭 → 매수/매도)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {LEADERS.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)', width: 16, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', minWidth: 92 }}>{l.sector}</span>
            <button onClick={() => goToStock(l.name)} style={{ ...stockLink, marginLeft: 'auto', textAlign: 'right' }}>{l.name}</button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────────── 패널 본체 ─────────────── */
type TabKey = 'candle' | 'theme' | 'leader';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'candle', label: '캔들 패턴' },
  { key: 'theme',  label: '상승 주도주' },
  { key: 'leader', label: '업종 대장주' },
];

export default function MarketGuidePanel({ defaultTab = 'candle' }: { defaultTab?: TabKey }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>(defaultTab);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? '투자 참고 패널 닫기' : '투자 참고 패널 열기'}
        title={open ? '닫기' : '캔들 패턴 · 테마 · 대장주 참고'}
        style={{
          position: 'fixed', top: '50%', right: open ? PANEL_W : 0, transform: 'translateY(-50%)',
          zIndex: 41, width: TAB_W, padding: '14px 0', borderRadius: '8px 0 0 8px',
          border: '1px solid var(--color-border)', borderRight: 'none',
          background: 'var(--color-card)', color: 'var(--color-accent)',
          cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1.2,
          writingMode: 'vertical-rl', transition: 'right 0.25s ease',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.25)',
        }}
      >
        {open ? '닫기 ›' : '‹ 투자 참고'}
      </button>

      <aside
        style={{
          position: 'fixed', top: 0, bottom: 0, right: 0, width: PANEL_W, zIndex: 40,
          background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
          boxShadow: '-6px 0 20px rgba(0,0,0,0.35)',
          transform: open ? 'translateX(0)' : `translateX(${PANEL_W}px)`,
          transition: 'transform 0.25s ease',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>📊 투자 참고 가이드</div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>인포그래픽 기반 · 투자 권유 아님</div>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '10px 12px 0' }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: tab === key ? 'var(--color-accent)' : 'rgba(110,118,129,0.18)',
                color: tab === key ? '#fff' : 'var(--color-muted)',
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {tab === 'candle' ? <CandleTab /> : tab === 'theme' ? <ThemeTab /> : <LeaderTab />}
          <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 12, lineHeight: 1.5 }}>
            ※ 종목명을 클릭하면 해당 종목 매수/매도 화면으로 이동합니다. 배수·기대치·정확도는 인포그래픽 출처 값이며 투자 권유가 아닙니다.
          </div>
        </div>
      </aside>
    </>
  );
}
