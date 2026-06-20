"""F8 펀더멘털 기업평가 API."""
from fastapi import APIRouter, HTTPException

from app.schemas.fundamental import FundamentalResponse
from app.services.fundamental import get_fundamentals

router = APIRouter(prefix="/fundamental", tags=["fundamental"])


@router.get("/{ticker}", response_model=FundamentalResponse)
def get_fundamental(ticker: str) -> FundamentalResponse:
    """PER·PBR·ROE·EPS·매출액·영업이익·당기순이익·부채비율·배당수익률 조회."""
    try:
        data = get_fundamentals(ticker.upper())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return FundamentalResponse(**data)
