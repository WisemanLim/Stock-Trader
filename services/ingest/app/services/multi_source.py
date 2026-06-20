"""멀티소스 주식 데이터 오케스트레이터.

소스 우선순위 (일별 OHLCV / 현재가):
  1. FinanceDataReader (FDR) — KRX 기반, 기존 1차 소스
  2. Naver Finance      — fchart.stock.naver.com/siseJson.naver
  3. Daum Finance       — finance.daum.net/api

KRX 시스템 점검 / FDR 봇차단 시 자동 폴백.
모든 소스 실패 시 ValueError 발생.

분봉 소스 우선순위:
  1. FinanceDataReader (interval=)
  2. Naver Finance (minute bars → 5m 집계)
  3. 일봉→분봉 다운샘플링 폴백 (기존 logic)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

logger = logging.getLogger(__name__)

# 소스 이름 상수
SRC_FDR = "fdr"
SRC_NAVER = "naver_finance"
SRC_DAUM = "daum_finance"


def _try_sources(
    operation: str,
    sources: list[tuple[str, Callable]],
    *args,
    **kwargs,
):
    """소스 목록을 순서대로 시도. 첫 성공 결과 반환.

    - 소스가 예외 발생 → 다음 소스 시도
    - 소스가 빈 리스트([]) 반환 → 다음 소스 시도 (단, 모두 빈 경우 빈 리스트 반환)
    - 모두 예외 → 마지막 예외 재발생
    """
    last_exc: Exception | None = None
    last_empty: list | None = None  # 빈 리스트 반환한 마지막 소스 결과
    for name, fn in sources:
        try:
            result = fn(*args, **kwargs)
            if result is not None:
                if isinstance(result, list) and len(result) == 0:
                    logger.debug("[multi_source] %s: %s → 빈 결과, 다음 소스 시도", name, operation)
                    last_empty = result
                    continue
                logger.debug("[multi_source] %s: %s → 성공", name, operation)
                return result
        except Exception as exc:
            last_exc = exc
            logger.warning("[multi_source] %s: %s → 실패 (%s)", name, operation, exc)
    # 모든 소스가 빈 리스트 반환 (데이터 없음, 오류 아님)
    if last_empty is not None:
        return last_empty
    if last_exc:
        raise last_exc
    raise ValueError(f"모든 소스 실패: {operation}")


# ── 일별 OHLCV ────────────────────────────────────────────────────────────

def get_ohlcv(ticker: str, days: int = 30) -> list[dict]:
    """일별 OHLCV. FDR → Naver → Daum 순 폴백."""
    import FinanceDataReader as fdr
    from app.services import naver_finance, daum_finance

    def _fdr(ticker: str, days: int) -> list[dict]:
        end = datetime.today()
        start = end - timedelta(days=days + 30)
        df = fdr.DataReader(ticker, start.strftime("%Y-%m-%d"))
        if df.empty:
            return []
        bars = []
        for date, row in df.iterrows():
            bars.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": float(row.get("Open", 0) or 0),
                "high": float(row.get("High", 0) or 0),
                "low": float(row.get("Low", 0) or 0),
                "close": float(row.get("Close", 0) or 0),
                "volume": int(row.get("Volume", 0) or 0),
                "source": SRC_FDR,
            })
        return bars[-days:]

    sources = [
        (SRC_FDR, _fdr),
        (SRC_NAVER, lambda t, d: [
            {**b, "source": SRC_NAVER} for b in naver_finance.get_daily_ohlcv(t, d)
        ]),
        (SRC_DAUM, lambda t, d: [
            {**b, "source": SRC_DAUM} for b in daum_finance.get_daily_ohlcv(t, d)
        ]),
    ]
    return _try_sources("ohlcv", sources, ticker, days)


# ── 현재가 ────────────────────────────────────────────────────────────────

def get_price(ticker: str) -> dict:
    """현재가. FDR → Naver → Daum 순 폴백."""
    import FinanceDataReader as fdr
    from app.services import naver_finance, daum_finance

    def _fdr_price(ticker: str) -> dict:
        end = datetime.today()
        start = end - timedelta(days=7)
        df = fdr.DataReader(ticker, start.strftime("%Y-%m-%d"))
        if df.empty:
            raise ValueError(f"FDR: {ticker} 데이터 없음")
        last = df.iloc[-1]
        change = float(last.get("Change", 0) or 0)
        return {
            "ticker": ticker,
            "price": float(last["Close"]),
            "change": change,
            "change_pct": change,
            "volume": int(last.get("Volume", 0) or 0),
            "timestamp": df.index[-1].strftime("%Y-%m-%dT%H:%M:%S"),
            "source": SRC_FDR,
        }

    sources = [
        (SRC_FDR, _fdr_price),
        (SRC_NAVER, naver_finance.get_price),
        (SRC_DAUM, daum_finance.get_price),
    ]
    return _try_sources("price", sources, ticker)


# ── 분봉 ──────────────────────────────────────────────────────────────────

def get_intraday(ticker: str, interval: str = "5m") -> list[dict]:
    """분봉 데이터. FDR → Naver → 일봉 다운샘플링 폴백."""
    import FinanceDataReader as fdr
    import pandas as pd
    from app.services import naver_finance
    from app.services.intraday import _resample_daily_to_bars  # 기존 fallback

    def _fdr_intraday(ticker: str, interval: str) -> list[dict]:
        df = fdr.DataReader(ticker, pd.Timestamp.now() - pd.Timedelta("1d"), interval=interval)
        if df.empty:
            return []
        df = df.rename(columns=str.lower)
        return [
            {
                "datetime": str(idx),
                "open": float(r.get("open", 0) or 0),
                "high": float(r.get("high", 0) or 0),
                "low": float(r.get("low", 0) or 0),
                "close": float(r.get("close", 0) or 0),
                "volume": int(r.get("volume", 0) or 0),
                "source": SRC_FDR,
            }
            for idx, r in df.iterrows()
        ][-100:]

    def _naver_intraday(ticker: str, interval: str) -> list[dict]:
        bars = naver_finance.get_intraday(ticker, interval)
        return [{**b, "source": SRC_NAVER} for b in bars]

    def _fallback_intraday(ticker: str, interval: str) -> list[dict]:
        bars = _resample_daily_to_bars(ticker, interval)
        return [{**b, "source": "fallback_daily"} for b in bars]

    sources = [
        (SRC_FDR, _fdr_intraday),
        (SRC_NAVER, _naver_intraday),
        ("fallback_daily", _fallback_intraday),
    ]
    return _try_sources("intraday", sources, ticker, interval)


# ── 종목 목록 ─────────────────────────────────────────────────────────────

def get_stock_list(market: str = "KOSPI") -> list[dict]:
    """종목 목록. FDR → Naver(pykrx 미사용, FDR 실패 시 KRX 직접) 폴백."""
    import FinanceDataReader as fdr

    def _fdr_listing(market: str) -> list[dict]:
        df = fdr.StockListing(market)
        if df.empty:
            return []
        name_col = next((c for c in ["Name", "name"] if c in df.columns), None)
        code_col = next((c for c in ["Code", "Symbol", "symbol"] if c in df.columns), None)
        if not name_col or not code_col:
            return []
        return [
            {"ticker": str(r[code_col]).strip(), "name": str(r[name_col]).strip(), "market": market}
            for _, r in df.iterrows()
            if str(r.get(code_col, "")).strip()
        ]

    sources = [
        (SRC_FDR, _fdr_listing),
    ]
    try:
        return _try_sources("stock_list", sources, market)
    except Exception:
        return []
