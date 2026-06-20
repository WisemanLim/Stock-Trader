"""F2.3 종목 스크리너 — RSI + 거래량 + 공매도 필터 (C-5: 80종, C-6: short_ratio)."""
from datetime import datetime, timedelta, timezone

import FinanceDataReader as fdr
import httpx
import pandas as pd
import ta

_INGEST_URL = "http://localhost:8003"


def _fetch_esg_score(ticker: str) -> float | None:
    """ingest /esg/{ticker} 에서 ESG 점수 조회."""
    try:
        r = httpx.get(f"{_INGEST_URL}/esg/{ticker}", timeout=2.0)
        if r.status_code == 200:
            return r.json().get("esg_score")
    except Exception:
        pass
    return None


def _fetch_short_ratio(ticker: str) -> float | None:
    """ingest /krx/short-selling/{ticker} 에서 최신 공매도 비율 조회."""
    try:
        r = httpx.get(f"{_INGEST_URL}/krx/short-selling/{ticker}", timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            rows = data.get("rows", [])
            if rows:
                return rows[0].get("short_ratio")
    except Exception:
        pass
    return None


def _quick_rsi(ticker: str) -> tuple[float | None, float, int]:
    """(rsi, close, volume) 반환. 데이터 부족 시 rsi=None."""
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=30)
        df = fdr.DataReader(ticker, start.strftime("%Y-%m-%d"))
        if len(df) < 14:
            return None, 0.0, 0
        close = df["Close"].astype(float)
        rsi = ta.momentum.RSIIndicator(close=close, window=14).rsi().iloc[-1]
        return (
            round(float(rsi), 2) if not pd.isna(rsi) else None,
            round(float(close.iloc[-1]), 2),
            int(df["Volume"].iloc[-1]) if "Volume" in df.columns else 0,
        )
    except Exception:
        return None, 0.0, 0


def _signal(rsi: float | None) -> str:
    if rsi is None:
        return "HOLD"
    if rsi < 30:
        return "BUY"
    if rsi > 70:
        return "SELL"
    return "HOLD"


def _stock_listing(market: str) -> pd.DataFrame:
    """KRX 다운 시 KOSPI+KOSDAQ 합산으로 폴백."""
    try:
        df = fdr.StockListing(market)
        # KRX 점검 페이지를 HTML 문자열로 반환하면 빈 DataFrame 처리
        if df is None or df.empty:
            raise ValueError("empty listing")
        return df
    except Exception:
        pass
    # 폴백: 시장별 조회 시도
    for fallback in ("KOSPI", "KOSDAQ"):
        if fallback == market:
            continue
        try:
            df = fdr.StockListing(fallback)
            if df is not None and not df.empty:
                return df
        except Exception:
            continue
    return pd.DataFrame()


def screen(
    market: str = "KRX",
    rsi_min: float | None = None,
    rsi_max: float | None = None,
    min_volume: int | None = None,
    limit: int = 20,
    signal_filter: str | None = None,
    min_close: float | None = None,
    max_close: float | None = None,
    max_short_ratio: float | None = None,
    min_esg_score: float | None = None,
) -> dict:
    listing = _stock_listing(market)

    if listing.empty:
        return {"market": market, "total_scanned": 0, "matched": 0, "results": []}

    code_col = next((c for c in ["Code", "Symbol"] if c in listing.columns), None)
    name_col = next((c for c in ["Name", "name"] if c in listing.columns), None)
    if code_col is None:
        raise ValueError("Cannot find code column in listing")

    # C-5: 80종목으로 확대
    tickers = listing[code_col].head(80).tolist()
    total = len(tickers)
    results = []

    for tk in tickers:
        rsi, close, vol = _quick_rsi(str(tk))
        if close == 0.0:
            continue
        if rsi_min is not None and (rsi is None or rsi < rsi_min):
            continue
        if rsi_max is not None and (rsi is None or rsi > rsi_max):
            continue
        if min_volume is not None and vol < min_volume:
            continue
        # C-5: 종가 범위 필터
        if min_close is not None and close < min_close:
            continue
        if max_close is not None and close > max_close:
            continue
        sig = _signal(rsi)
        if signal_filter is not None and sig != signal_filter.upper():
            continue
        # C-6: 공매도 비율 조회 + 필터
        short_ratio: float | None = None
        if max_short_ratio is not None:
            short_ratio = _fetch_short_ratio(str(tk))
            if short_ratio is not None and short_ratio > max_short_ratio:
                continue
        # D-6: ESG 점수 조회 + 필터
        esg_score: float | None = None
        if min_esg_score is not None:
            esg_score = _fetch_esg_score(str(tk))
            if esg_score is None or esg_score < min_esg_score:
                continue
        name = str(listing.loc[listing[code_col] == tk, name_col].values[0]) if name_col else tk
        results.append({
            "ticker": str(tk),
            "name": name,
            "close": close,
            "volume": vol,
            "rsi": rsi,
            "signal": sig,
            "short_ratio": short_ratio,
            "esg_score": esg_score,
        })
        if len(results) >= limit:
            break

    return {
        "market": market,
        "total_scanned": total,
        "matched": len(results),
        "results": results,
    }
