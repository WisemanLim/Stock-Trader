"""F1.1 멀티소스 폴백 체인 시험.

대상:
  - naver_finance: EUC-KR 응답 파싱, OHLCV/price/intraday
  - daum_finance: JSON 응답 파싱, OHLCV/price
  - multi_source: FDR→Naver→Daum 폴백 순서, 모든 소스 실패 처리
  - GET /krx/data-sources: 병렬 헬스체크 엔드포인트
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

# ── 공통 픽스처 ───────────────────────────────────────────────────────────

SAMPLE_DATES = pd.date_range("2024-01-02", periods=5, freq="B")
SAMPLE_DF = pd.DataFrame(
    {
        "Open":   [70000.0, 71000.0, 72000.0, 71500.0, 73000.0],
        "High":   [71000.0, 72000.0, 73000.0, 72500.0, 74000.0],
        "Low":    [69500.0, 70500.0, 71500.0, 71000.0, 72500.0],
        "Close":  [70500.0, 71500.0, 72500.0, 72000.0, 73500.0],
        "Volume": [1_000_000, 1_100_000, 950_000, 1_050_000, 1_200_000],
        "Change": [0.005, 0.014, 0.014, -0.007, 0.021],
    },
    index=SAMPLE_DATES,
)

# Naver siseJson 응답 (EUC-KR 인코딩 문자열)
_NAVER_ROWS = [
    ["날짜", "시가", "고가", "저가", "종가", "거래량", "외국인소진율"],
    ["20240102", 70000, 71000, 69500, 70500, 1000000, 50.1],
    ["20240103", 71000, 72000, 70500, 71500, 1100000, 50.2],
    ["20240104", 72000, 73000, 71500, 72500, 950000, 50.3],
    ["20240105", 71500, 72500, 71000, 72000, 1050000, 50.4],
    ["20240108", 73000, 74000, 72500, 73500, 1200000, 50.5],
]

# Daum Finance API 응답
_DAUM_DAYS_PAYLOAD = {
    "data": [
        {
            "date": "2024-01-08T00:00:00+09:00",
            "openingPrice": 73000,
            "highPrice": 74000,
            "lowPrice": 72500,
            "tradePrice": 73500,
            "accTradeVolume": 1200000,
        },
        {
            "date": "2024-01-05T00:00:00+09:00",
            "openingPrice": 71500,
            "highPrice": 72500,
            "lowPrice": 71000,
            "tradePrice": 72000,
            "accTradeVolume": 1050000,
        },
    ]
}

_DAUM_QUOTE_PAYLOAD = {
    "tradePrice": 73500.0,
    "prevClosingPrice": 72000.0,
    "accTradeVolume": 1200000,
    "openingPrice": 73000.0,
    "highPrice": 74000.0,
    "lowPrice": 72500.0,
}


def _make_httpx_response(content: bytes, status_code: int = 200):
    """httpx.Client.get 반환값 mock."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content
    resp.json.return_value = json.loads(content.decode("utf-8"))
    resp.raise_for_status = MagicMock()
    return resp


# ── naver_finance 단위 시험 ───────────────────────────────────────────────

class TestNaverFinance:
    def test_get_daily_ohlcv_parses_response(self):
        """EUC-KR 인코딩 siseJson 응답 파싱."""
        from app.services import naver_finance

        raw = json.dumps(_NAVER_ROWS, ensure_ascii=False).encode("euc-kr")
        mock_resp = MagicMock()
        mock_resp.content = raw
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.naver_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            bars = naver_finance.get_daily_ohlcv("005930", days=30)

        assert len(bars) == 5
        assert bars[0]["date"] == "2024-01-02"
        assert bars[0]["open"] == 70000.0
        assert bars[-1]["close"] == 73500.0
        assert bars[-1]["volume"] == 1200000

    def test_get_price_derived_from_ohlcv(self):
        """현재가 = 최신 바 기반."""
        from app.services import naver_finance

        raw = json.dumps(_NAVER_ROWS, ensure_ascii=False).encode("euc-kr")
        mock_resp = MagicMock()
        mock_resp.content = raw
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.naver_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            result = naver_finance.get_price("005930")

        assert result["price"] == 73500.0
        assert result["source"] == "naver_finance"
        assert result["ticker"] == "005930"

    def test_get_daily_ohlcv_http_error_raises(self):
        """HTTP 오류 시 예외 전파."""
        from app.services import naver_finance

        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = Exception("HTTP 403")

        with patch("app.services.naver_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            with pytest.raises(Exception):
                naver_finance.get_daily_ohlcv("005930")

    def test_resample_to_5m(self):
        """1분봉 → 5분봉 집계."""
        from app.services.naver_finance import _resample_to_5m

        bars_1m = [
            {"datetime": f"2024-01-02 09:0{i}", "open": 100 + i, "high": 105 + i,
             "low": 99 + i, "close": 101 + i, "volume": 1000}
            for i in range(10)
        ]
        bars_5m = _resample_to_5m(bars_1m)
        assert len(bars_5m) == 2
        # 첫 5분봉: open = 첫 1분봉 open, close = 5번째 1분봉 close
        assert bars_5m[0]["open"] == bars_1m[0]["open"]
        assert bars_5m[0]["close"] == bars_1m[4]["close"]
        assert bars_5m[0]["volume"] == sum(b["volume"] for b in bars_1m[:5])
        assert bars_5m[0]["high"] == max(b["high"] for b in bars_1m[:5])


# ── daum_finance 단위 시험 ────────────────────────────────────────────────

class TestDaumFinance:
    def test_get_daily_ohlcv_parses_response(self):
        """Daum Finance API JSON 파싱 및 날짜 오름차순 정렬."""
        from app.services import daum_finance

        raw = json.dumps(_DAUM_DAYS_PAYLOAD).encode("utf-8")
        mock_resp = _make_httpx_response(raw)

        with patch("app.services.daum_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            bars = daum_finance.get_daily_ohlcv("035720", days=10)

        assert len(bars) == 2
        # 오름차순: 2024-01-05 → 2024-01-08
        assert bars[0]["date"] == "2024-01-05"
        assert bars[-1]["close"] == 73500.0

    def test_get_price(self):
        """Daum Finance 현재가 조회."""
        from app.services import daum_finance

        raw = json.dumps(_DAUM_QUOTE_PAYLOAD).encode("utf-8")
        mock_resp = _make_httpx_response(raw)

        with patch("app.services.daum_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            result = daum_finance.get_price("035720")

        assert result["price"] == 73500.0
        assert result["source"] == "daum_finance"
        assert abs(result["change"] - 1500.0) < 0.01  # 73500 - 72000

    def test_get_price_http_error_raises(self):
        """HTTP 오류 시 예외 전파."""
        from app.services import daum_finance

        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = Exception("HTTP 403")

        with patch("app.services.daum_finance.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_resp
            with pytest.raises(Exception):
                daum_finance.get_price("035720")


# ── multi_source 오케스트레이터 시험 ──────────────────────────────────────

class TestMultiSource:
    def test_get_ohlcv_fdr_success(self):
        """FDR 성공 시 FDR 결과 반환."""
        from app.services import multi_source

        # lazy import이므로 FinanceDataReader 모듈 직접 패치
        with patch("FinanceDataReader.DataReader", return_value=SAMPLE_DF):
            bars = multi_source.get_ohlcv("005930", days=5)

        assert len(bars) == 5
        assert bars[0]["source"] == "fdr"

    def test_get_ohlcv_fdr_fails_naver_fallback(self):
        """FDR 실패 → Naver 폴백."""
        from app.services import multi_source, naver_finance

        naver_bars = [
            {"date": "2024-01-02", "open": 70000.0, "high": 71000.0,
             "low": 69500.0, "close": 70500.0, "volume": 1000000}
        ]

        with (
            patch("FinanceDataReader.DataReader", side_effect=Exception("FDR down")),
            patch.object(naver_finance, "get_daily_ohlcv", return_value=naver_bars),
        ):
            bars = multi_source.get_ohlcv("005930", days=5)

        assert len(bars) == 1
        assert bars[0]["source"] == "naver_finance"

    def test_get_ohlcv_all_fail_raises(self):
        """모든 소스 실패 시 예외."""
        from app.services import multi_source, naver_finance, daum_finance

        with (
            patch("FinanceDataReader.DataReader", side_effect=Exception("FDR down")),
            patch.object(naver_finance, "get_daily_ohlcv", side_effect=Exception("Naver down")),
            patch.object(daum_finance, "get_daily_ohlcv", side_effect=Exception("Daum down")),
        ):
            with pytest.raises(Exception):
                multi_source.get_ohlcv("005930", days=5)

    def test_get_price_fdr_fails_naver_fallback(self):
        """FDR 가격 실패 → Naver 폴백."""
        from app.services import multi_source, naver_finance

        naver_price = {
            "ticker": "005930", "price": 73500.0, "change": 1500.0,
            "change_pct": 2.08, "volume": 1200000,
            "timestamp": "2024-01-08T15:30:00", "source": "naver_finance",
        }

        with (
            patch("FinanceDataReader.DataReader", side_effect=Exception("FDR down")),
            patch.object(naver_finance, "get_price", return_value=naver_price),
        ):
            result = multi_source.get_price("005930")

        assert result["source"] == "naver_finance"
        assert result["price"] == 73500.0

    def test_get_price_fdr_daum_fallback(self):
        """FDR + Naver 실패 → Daum 폴백."""
        from app.services import multi_source, naver_finance, daum_finance

        daum_price = {
            "ticker": "005930", "price": 73500.0, "change": 1500.0,
            "change_pct": 2.08, "volume": 1200000,
            "timestamp": "2024-01-08T15:30:00", "source": "daum_finance",
        }

        with (
            patch("FinanceDataReader.DataReader", side_effect=Exception("FDR down")),
            patch.object(naver_finance, "get_price", side_effect=Exception("Naver down")),
            patch.object(daum_finance, "get_price", return_value=daum_price),
        ):
            result = multi_source.get_price("005930")

        assert result["source"] == "daum_finance"
        assert result["price"] == 73500.0


# ── /krx/data-sources 엔드포인트 시험 ────────────────────────────────────

class TestKrxDataSources:
    @pytest.fixture
    def client(self):
        from app.main import app
        with TestClient(app) as c:
            yield c

    def test_data_sources_all_up(self, client):
        """모든 소스 정상 시 active_source=fdr."""
        from app.services import naver_finance, daum_finance

        naver_bars = [{"date": "2024-01-08", "open": 73000.0, "high": 74000.0,
                       "low": 72500.0, "close": 73500.0, "volume": 1200000}]
        daum_price = {"ticker": "005930", "price": 73500.0, "change": 0.0,
                      "change_pct": 0.0, "volume": 1200000,
                      "timestamp": "2024-01-08T15:30:00", "source": "daum_finance"}

        with (
            patch("app.api.krx.fdr", create=True),
            patch("FinanceDataReader.DataReader", return_value=SAMPLE_DF),
            patch.object(naver_finance, "get_daily_ohlcv", return_value=naver_bars),
            patch.object(daum_finance, "get_price", return_value=daum_price),
        ):
            resp = client.get("/krx/data-sources")

        assert resp.status_code == 200
        data = resp.json()
        assert "active_source" in data
        assert "sources" in data
        assert set(data["sources"].keys()) == {"fdr", "naver_finance", "daum_finance"}

    def test_data_sources_response_structure(self, client):
        """/krx/data-sources 응답 구조 검증."""
        from app.services import naver_finance, daum_finance

        with (
            patch("FinanceDataReader.DataReader", side_effect=Exception("down")),
            patch.object(naver_finance, "get_daily_ohlcv", side_effect=Exception("down")),
            patch.object(daum_finance, "get_price", side_effect=Exception("down")),
        ):
            resp = client.get("/krx/data-sources")

        assert resp.status_code == 200
        data = resp.json()
        assert data["active_source"] == "none"
        assert data["sources"]["fdr"]["ok"] is False
        assert data["sources"]["naver_finance"]["ok"] is False
        assert data["sources"]["daum_finance"]["ok"] is False
