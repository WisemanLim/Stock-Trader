"""F2.3 스크리너 스키마 (C-5: 80종 확대, C-6: 공매도 필터)."""
from pydantic import BaseModel, Field


class ScreenerFilter(BaseModel):
    market: str = "KRX"
    rsi_max: float | None = None
    rsi_min: float | None = None
    min_volume: int | None = None
    limit: int = 20
    # C-5: 추가 필터
    signal: str | None = None          # BUY | SELL | HOLD 필터
    min_close: float | None = None     # 최소 종가
    max_close: float | None = None     # 최대 종가
    # C-6: 공매도 비율 필터
    max_short_ratio: float | None = Field(default=None, description="최대 공매도 비율 (0.0~1.0)")
    # D-6: ESG 점수 필터
    min_esg_score: float | None = Field(default=None, description="최소 ESG 점수 (0~100)")
    # F8: 펀더멘털 필터
    max_per: float | None = Field(default=None, description="최대 PER (예: 30)")
    max_pbr: float | None = Field(default=None, description="최대 PBR (예: 3.0)")
    min_roe: float | None = Field(default=None, description="최소 ROE % (예: 5.0)")
    max_debt_ratio: float | None = Field(default=None, description="최대 부채비율 % (예: 200)")
    min_dividend_yield: float | None = Field(default=None, description="최소 배당수익률 % (예: 2.0)")


class ScreenerResult(BaseModel):
    ticker: str
    name: str
    close: float
    volume: int
    rsi: float | None
    signal: str
    short_ratio: float | None = None   # C-6: 공매도 비율
    esg_score: float | None = None    # D-6: ESG 점수


class ScreenerResponse(BaseModel):
    market: str
    total_scanned: int
    matched: int
    results: list[ScreenerResult]
