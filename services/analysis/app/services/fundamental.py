"""F2.4 펀더멘털 기업평가 서비스.

지표 정의:
  PER   = 주가 / EPS  — 수익 대비 주가 배수 (낮을수록 저평가)
  PBR   = 주가 / BPS  — 자산 대비 주가 배수 (1.0 미만 = 자산가치 이하)
  ROE   = 당기순이익 / 자기자본 × 100  — 자본 수익률 (%)
  EPS   = 당기순이익 / 발행주식수      — 주당 순이익
  매출액   = 회사 총 판매 수익 (억원)
  영업이익 = 매출 - 원가 - 판관비       — 본업 수익성 (억원)
  당기순이익 = 세후 최종 이익 (억원)
  부채비율 = 총부채 / 자기자본 × 100 (%) — 재무건전성
  배당수익률 = 연간배당 / 주가 × 100 (%)
  이동평균 데드크로스 = 단기 MA < 장기 MA (ma_death_cross — risk.rs 에서 BlockBuy)
"""
from __future__ import annotations

import re

import httpx

# GET ?itemcode=005930 → {"per":28.61,"eps":12372.0,"pbr":4.92,"now":354000,...}
_NAVER_SUMMARY_URL = "https://api.finance.naver.com/service/itemSummary.naver"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://finance.naver.com",
    "Accept-Language": "ko-KR,ko;q=0.9",
}


def _parse_number(val: object) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val == val else None  # nan check
    s = re.sub(r"[,%]", "", str(val)).strip()
    if s in ("", "-", "N/A", "n/a", "None"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _fetch_naver_summary(client: httpx.Client, ticker: str, result: dict) -> None:
    """Naver Finance itemSummary → PER, PBR, EPS."""
    try:
        r = client.get(_NAVER_SUMMARY_URL, params={"itemcode": ticker}, headers=_HEADERS)
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, dict):
            return
        result["per"] = _parse_number(data.get("per"))
        result["pbr"] = _parse_number(data.get("pbr"))
        result["eps"] = _parse_number(data.get("eps"))
    except Exception:
        pass


def _fetch_yfinance(ticker: str, result: dict) -> None:
    """Yahoo Finance → ROE, 매출액, 영업이익, 당기순이익, 부채비율, 배당수익률, market."""
    try:
        import yfinance as yf  # optional dep
    except ImportError:
        return

    # KOSPI: {code}.KS  /  KOSDAQ: {code}.KQ
    market = None
    t = None
    for suffix, mkt in ((".KS", "KOSPI"), (".KQ", "KOSDAQ")):
        try:
            candidate = yf.Ticker(f"{ticker}{suffix}")
            info = candidate.info
            # Presence of quoteType confirms a valid ticker
            if info.get("quoteType"):
                t = candidate
                market = mkt
                result["market"] = mkt
                break
        except Exception:
            continue

    if t is None:
        return

    try:
        info = t.info
        roe_raw = info.get("returnOnEquity")
        if roe_raw is not None:
            result["roe"] = round(float(roe_raw) * 100, 2)  # 0.189 → 18.9%

        div_raw = info.get("dividendYield")
        if div_raw is not None:
            result["dividend_yield"] = round(float(div_raw) * 100, 4)
    except Exception:
        pass

    try:
        fin = t.financials
        if fin is not None and not fin.empty:
            for row_name, field in (
                ("Total Revenue", "revenue"),
                ("Operating Revenue", "revenue"),  # fallback
                ("Operating Income", "operating_profit"),
                ("Net Income", "net_income"),
                ("Net Income From Continuing Operation Net Minority Interest", "net_income"),
            ):
                if row_name in fin.index and result.get(field) is None:
                    val = fin.loc[row_name].iloc[0]
                    if val == val:  # nan guard
                        result[field] = round(float(val) / 1e8, 0)  # KRW → 억원
    except Exception:
        pass

    try:
        bs = t.balance_sheet
        if bs is not None and not bs.empty:
            total_liab = None
            equity = None
            for row_name in ("Total Liabilities Net Minority Interest",):
                if row_name in bs.index:
                    total_liab = float(bs.loc[row_name].iloc[0])
            for row_name in ("Common Stock Equity", "Stockholders Equity"):
                if row_name in bs.index and equity is None:
                    equity = float(bs.loc[row_name].iloc[0])
            if total_liab and equity and equity != 0:
                result["debt_ratio"] = round(total_liab / equity * 100, 2)
    except Exception:
        pass


def get_fundamentals(ticker: str) -> dict:
    """펀더멘털 지표 조회 — Naver Finance (PER/PBR/EPS) + Yahoo Finance (나머지)."""
    result: dict = {
        "ticker": ticker,
        "name": None,
        "per": None,
        "pbr": None,
        "eps": None,
        "bps": None,
        "roe": None,
        "revenue": None,
        "operating_profit": None,
        "net_income": None,
        "debt_ratio": None,
        "dividend_yield": None,
        "market": None,
        "source": "naver+yahoo",
    }

    with httpx.Client(timeout=6) as client:
        _fetch_naver_summary(client, ticker, result)

    _fetch_yfinance(ticker, result)
    return result
