"""F1 ingest 서비스 시험 — market API (mock FinanceDataReader)."""
from unittest.mock import patch


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "ingest"


def test_get_price_ok(client, mock_fdr):
    r = client.get("/market/price/005930")
    assert r.status_code == 200
    data = r.json()
    assert data["ticker"] == "005930"
    assert data["price"] == 73500.0
    assert data["volume"] == 1_200_000
    assert "timestamp" in data
    # multi_source 오케스트레이터 소스 표기 (FDR 성공 시 "fdr")
    assert data["source"] == "fdr"


def test_get_price_uppercase_normalization(client, mock_fdr):
    r = client.get("/market/price/aapl")
    assert r.status_code == 200
    assert r.json()["ticker"] == "AAPL"


def test_get_price_not_found(client, mock_fdr_empty):
    # FDR empty → multi_source fallback 모두 실패 → 404
    from app.services import naver_finance, daum_finance
    with (
        patch.object(naver_finance, "get_price", side_effect=ValueError("not found")),
        patch.object(daum_finance, "get_price", side_effect=ValueError("not found")),
    ):
        r = client.get("/market/price/INVALID")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_get_ohlcv_ok(client, mock_fdr):
    r = client.get("/market/ohlcv/005930?days=5")
    assert r.status_code == 200
    data = r.json()
    assert data["ticker"] == "005930"
    assert data["count"] == 5
    assert len(data["bars"]) == 5
    bar = data["bars"][0]
    for key in ("date", "open", "high", "low", "close", "volume"):
        assert key in bar, f"missing key: {key}"
    assert bar["close"] == 70500.0


def test_get_ohlcv_empty(client, mock_fdr_empty):
    # FDR empty → multi_source fallback 모두 빈 결과 → 200 count=0
    from app.services import naver_finance, daum_finance
    with (
        patch.object(naver_finance, "get_daily_ohlcv", return_value=[]),
        patch.object(daum_finance, "get_daily_ohlcv", return_value=[]),
    ):
        r = client.get("/market/ohlcv/UNKNOWN")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 0
    assert data["bars"] == []


def test_openapi_schema(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/market/price/{ticker}" in paths
    assert "/market/ohlcv/{ticker}" in paths
    assert "/market/tickers/{market}" in paths


def test_redis_unavailable_does_not_break_price(client, mock_fdr):
    """TC-08: Redis 미설정 시 API 정상 응답 — 부분 장애 허용."""
    r = client.get("/market/price/005930")
    assert r.status_code == 200


def test_timestamp_iso8601_format(client, mock_fdr):
    """TC-09: timestamp ISO 8601 형식 (감사 로그·정산 대사 요건)."""
    import re
    r = client.get("/market/price/005930")
    ts = r.json()["timestamp"]
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$", ts), f"bad timestamp: {ts}"
