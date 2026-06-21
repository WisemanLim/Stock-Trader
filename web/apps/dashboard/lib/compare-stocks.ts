// 세션 내 비교종목 목록 관리 — sessionStorage(로그아웃/재기동 시 자동 초기화)
const STORAGE_KEY = 'st_compare';
export const COMPARE_EVENT = 'st_compare_change';

// 종목별 색상 팔레트 (캔들차트 오버레이 색상과 공유 예정)
export const COMPARE_PALETTE = [
  '#58a6ff', '#f0883e', '#3fb950', '#d2a8ff', '#ff7b72',
  '#ffa657', '#79c0ff', '#56d364', '#e3b341', '#bc8cff',
];

export type CompareEntry = {
  ticker: string;
  name: string;
  color: string;
};

function load(): CompareEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompareEntry[]) : [];
  } catch { return []; }
}

function commit(list: CompareEntry[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

function pickColor(existing: CompareEntry[]): string {
  const used = new Set(existing.map(e => e.color));
  return COMPARE_PALETTE.find(c => !used.has(c)) ?? COMPARE_PALETTE[existing.length % COMPARE_PALETTE.length];
}

export function getCompareList(): CompareEntry[] { return load(); }

export function isInCompare(ticker: string): boolean {
  return load().some(e => e.ticker === ticker);
}

export function addToCompare(ticker: string, name: string): void {
  const list = load();
  if (list.some(e => e.ticker === ticker)) return;
  commit([...list, { ticker, name, color: pickColor(list) }]);
}

export function removeFromCompare(ticker: string): void {
  commit(load().filter(e => e.ticker !== ticker));
}

export function toggleCompare(ticker: string, name: string): void {
  isInCompare(ticker) ? removeFromCompare(ticker) : addToCompare(ticker, name);
}

export function clearCompareList(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(COMPARE_EVENT));
}
