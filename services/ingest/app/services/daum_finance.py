"""Daum Finance data provider — 일별 OHLCV, 현재가.

엔드포인트: finance.daum.net/api
- Referer + User-Agent 헤더 필수 (없으면 403)
- 일별: GET /quote/A{code}/days
- 현재가: GET /quotes/A{code}
- 응답: JSON (UTF-8)
"""
from __future__ import annotations

from datetime import datetime

import httpx

_BASE = "https://finance.daum.net/api"


def _headers(ticker: str) -> dict:
    code = f"A{ticker}" if ticker.isdigit() else ticker
    return {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": f"https://finance.daum.net/quotes/{code}",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
    }


def _code(ticker: str) -> str:
    return f"A{ticker}" if ticker.isdigit() else ticker


def get_daily_ohlcv(ticker: str, days: int = 30) -> list[dict]:
    """Daum Finance 일별 OHLCV. 최대 days일 반환 (최신 → 오래된 순 역정렬 후 반환)."""
    code = _code(ticker)
    url = f"{_BASE}/quote/{code}/days"
    per_page = min(days + 20, 100)
    params = {
        "symbolCode": code,
        "page": 1,
        "perPage": per_page,
        "pagination": "true",
    }
    with httpx.Client(timeout=10) as client:
        resp = client.get(url, params=params, headers=_headers(ticker))
        resp.raise_for_status()
        payload = resp.json()

    bars: list[dict] = []
    for item in payload.get("data", []):
        try:
            # date 형식: "2024-01-03T00:00:00+09:00"
            date_str = str(item.get("date", ""))[:10]
            bars.append({
                "date": date_str,
                "open": float(item.get("openingPrice", 0) or 0),
                "high": float(item.get("highPrice", 0) or 0),
                "low": float(item.get("lowPrice", 0) or 0),
                "close": float(item.get("tradePrice", 0) or 0),
                "volume": int(item.get("accTradeVolume", 0) or 0),
            })
        except (ValueError, TypeError, KeyError):
            continue

    # Daum은 최신 → 오래된 순 반환 → 오름차순 정렬
    bars.sort(key=lambda b: b["date"])
    return bars[-days:]


def get_price(ticker: str) -> dict:
    """Daum Finance 현재가 조회."""
    code = _code(ticker)
    url = f"{_BASE}/quotes/{code}"
    with httpx.Client(timeout=10) as client:
        resp = client.get(url, headers=_headers(ticker))
        resp.raise_for_status()
        item = resp.json()

    price = float(item.get("tradePrice", 0) or 0)
    prev = float(item.get("prevClosingPrice", price) or price)
    change = price - prev
    change_pct = (change / prev * 100) if prev else 0.0

    return {
        "ticker": ticker,
        "price": price,
        "change": change,
        "change_pct": change_pct,
        "volume": int(item.get("accTradeVolume", 0) or 0),
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "source": "daum_finance",
    }
