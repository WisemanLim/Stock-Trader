"""FinanceDataReader wrapper — F1.1 시세 파이프라인.

FDR 1차 소스, 실패 시 multi_source 오케스트레이터(Naver→Daum) 자동 폴백.
"""
import FinanceDataReader as fdr
from app.services import multi_source


class FinanceReaderService:
    def get_price(self, ticker: str) -> dict:
        return multi_source.get_price(ticker)

    def get_ohlcv(self, ticker: str, days: int = 30) -> list[dict]:
        return multi_source.get_ohlcv(ticker, days)

    def get_stock_list(self, market: str = "KRX") -> list[dict]:
        try:
            df = fdr.StockListing(market)
        except Exception as exc:
            raise ValueError(f"Cannot list {market}: {exc}") from exc
        if df.empty:
            return []
        name_col = next((c for c in ["Name", "name"] if c in df.columns), None)
        code_col = next((c for c in ["Code", "Symbol", "symbol"] if c in df.columns), None)
        market_col = next((c for c in ["Market", "market"] if c in df.columns), None)
        cols = [c for c in [code_col, name_col, market_col] if c]
        return df[cols].head(100).rename(
            columns={code_col: "code", name_col: "name", market_col: "market"}
        ).to_dict(orient="records")
