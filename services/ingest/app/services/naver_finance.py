"""Naver Finance data provider — 일별 OHLCV, 현재가, 분봉.

엔드포인트: fchart.stock.naver.com/siseJson.naver
- 무인증, 공개 API
- 일별(timeframe=day) / 분봉(timeframe=minute) 지원
- 응답: JSON array-of-arrays, EUC-KR 인코딩
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import httpx

_SISE_URL = "https://fchart.stock.naver.com/siseJson.naver"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://finance.naver.com",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

_COL_MAP = {
    "날짜": "date",
    "시가": "open",
    "고가": "high",
    "저가": "low",
    "종가": "close",
    "거래량": "volume",
}


def _parse_sise_response(raw: str) -> tuple[list[str], list[list]]:
    """siseJson 응답(JS array-of-arrays) 파싱. (header, rows) 반환."""
    text = raw.strip()
    # 응답이 괄호로 감싸진 경우 제거
    if text.startswith("(") and text.endswith(")"):
        text = text[1:-1]
    if not text:  # 빈 응답 "()" — 장외시간 또는 데이터 없음
        return [], []
    rows = json.loads(text)
    if not rows or not isinstance(rows, list):
        return [], []
    header = [str(h) for h in rows[0]]
    return header, rows[1:]


def get_daily_ohlcv(ticker: str, days: int = 30) -> list[dict]:
    """Naver Finance 일별 OHLCV. 최대 days일 반환."""
    end = datetime.today()
    # 주말·공휴일 버퍼 포함
    start = end - timedelta(days=days + 60)
    params = {
        "symbol": ticker,
        "requestType": 1,
        "startTime": start.strftime("%Y%m%d"),
        "endTime": end.strftime("%Y%m%d"),
        "timeframe": "day",
    }
    with httpx.Client(timeout=10) as client:
        resp = client.get(_SISE_URL, params=params, headers=_HEADERS)
        resp.raise_for_status()
        # Naver는 EUC-KR 인코딩
        raw = resp.content.decode("euc-kr", errors="replace")

    header, data_rows = _parse_sise_response(raw)
    if not header:
        return []

    bars: list[dict] = []
    for row in data_rows:
        try:
            d = {_COL_MAP[h]: row[i] for i, h in enumerate(header) if h in _COL_MAP}
            date_str = str(d.get("date", ""))
            if len(date_str) == 8:
                d["date"] = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            bars.append({
                "date": d.get("date", ""),
                "open": float(d.get("open", 0) or 0),
                "high": float(d.get("high", 0) or 0),
                "low": float(d.get("low", 0) or 0),
                "close": float(d.get("close", 0) or 0),
                "volume": int(d.get("volume", 0) or 0),
            })
        except (ValueError, TypeError, KeyError, IndexError):
            continue

    # 날짜 오름차순 → 최신 N일만
    bars.sort(key=lambda b: b["date"])
    return bars[-days:]


def get_price(ticker: str) -> dict:
    """Naver Finance 현재가 (일별 최신 바 기반)."""
    bars = get_daily_ohlcv(ticker, days=7)
    if not bars:
        raise ValueError(f"Naver Finance: {ticker} 데이터 없음")
    last = bars[-1]
    prev = bars[-2] if len(bars) >= 2 else last
    change = last["close"] - prev["close"]
    change_pct = (change / prev["close"] * 100) if prev["close"] else 0.0
    return {
        "ticker": ticker,
        "price": last["close"],
        "change": change,
        "change_pct": change_pct,
        "volume": last["volume"],
        "timestamp": last["date"] + "T15:30:00",
        "source": "naver_finance",
    }


def get_intraday(ticker: str, interval: str = "5m") -> list[dict]:
    """Naver Finance 분봉 데이터.

    timeframe=minute → 1분봉 반환. 5m 요청 시 5봉 집계.
    당일 데이터만 제공 (장 중 호출 시 유효).
    """
    today = datetime.today()
    params = {
        "symbol": ticker,
        "requestType": 1,
        "startTime": today.strftime("%Y%m%d"),
        "endTime": today.strftime("%Y%m%d"),
        "timeframe": "minute",
    }
    with httpx.Client(timeout=10) as client:
        resp = client.get(_SISE_URL, params=params, headers=_HEADERS)
        resp.raise_for_status()
        raw = resp.content.decode("euc-kr", errors="replace")

    header, data_rows = _parse_sise_response(raw)
    if not header:
        return []

    bars_1m: list[dict] = []
    for row in data_rows:
        try:
            # 분봉 날짜 형식: 20240103090500 (14자리) 또는 202401030905 (12자리)
            dt_raw = str(row[0]).strip()
            if len(dt_raw) >= 12:
                dt = f"{dt_raw[:4]}-{dt_raw[4:6]}-{dt_raw[6:8]} {dt_raw[8:10]}:{dt_raw[10:12]}"
            else:
                dt = dt_raw
            bars_1m.append({
                "datetime": dt,
                "open": float(row[1] or 0),
                "high": float(row[2] or 0),
                "low": float(row[3] or 0),
                "close": float(row[4] or 0),
                "volume": int(row[5] or 0) if len(row) > 5 else 0,
            })
        except (ValueError, TypeError, IndexError):
            continue

    if interval == "5m" and bars_1m:
        return _resample_to_5m(bars_1m)[-100:]
    return bars_1m[-100:]


def _resample_to_5m(bars_1m: list[dict]) -> list[dict]:
    """1분봉 → 5분봉 집계."""
    result: list[dict] = []
    bucket: list[dict] = []
    for bar in bars_1m:
        bucket.append(bar)
        if len(bucket) == 5:
            result.append(_merge_bucket(bucket))
            bucket = []
    if bucket:
        result.append(_merge_bucket(bucket))
    return result


def _merge_bucket(bucket: list[dict]) -> dict:
    return {
        "datetime": bucket[0]["datetime"],
        "open": bucket[0]["open"],
        "high": max(b["high"] for b in bucket),
        "low": min(b["low"] for b in bucket),
        "close": bucket[-1]["close"],
        "volume": sum(b["volume"] for b in bucket),
    }
