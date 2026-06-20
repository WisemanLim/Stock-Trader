"""F8 펀더멘털 기업평가 스키마."""
from pydantic import BaseModel


class FundamentalResponse(BaseModel):
    ticker: str
    name: str | None = None
    # 밸류에이션
    per: float | None = None          # 주가수익비율 (Price/Earnings)
    pbr: float | None = None          # 주가순자산비율 (Price/Book)
    eps: float | None = None          # 주당순이익 (Earnings Per Share)
    bps: float | None = None          # 주당순자산 (Book Value Per Share)
    # 수익성
    roe: float | None = None          # 자기자본이익률 (Return on Equity, %)
    # 성장성 (최근 연간)
    revenue: float | None = None      # 매출액 (억원)
    operating_profit: float | None = None  # 영업이익 (억원)
    net_income: float | None = None   # 당기순이익 (억원)
    # 안정성
    debt_ratio: float | None = None   # 부채비율 (%)
    # 배당
    dividend_yield: float | None = None  # 배당수익률 (%)
    # 시장 분류
    market: str | None = None         # KOSPI | KOSDAQ
    source: str = "naver"
