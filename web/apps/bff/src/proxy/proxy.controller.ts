import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { safeTicker } from '../ticker.util';
import { SERVICES, ServiceKey } from '../config';

@Controller('api')
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'bff' };
  }

  // 백엔드 서비스 헬스 병렬 조회 (2s timeout, 응답 상태만 확인).
  @Get('services/health')
  async servicesHealth() {
    const keys: ServiceKey[] = ['ingest', 'analysis', 'agents', 'risk'];
    const results = await Promise.allSettled(
      keys.map(k =>
        fetch(`${SERVICES[k]}/health`, { signal: AbortSignal.timeout(2000) }),
      ),
    );
    return Object.fromEntries(
      keys.map((k, i) => {
        const r = results[i];
        return [k, r.status === 'fulfilled' && (r.value as Response).ok];
      }),
    );
  }

  @Get('price/:ticker')
  price(@Param('ticker') ticker: string) {
    return this.proxy.price(ticker);
  }

  @Get('indicators/:ticker')
  indicators(@Param('ticker') ticker: string) {
    return this.proxy.fetchJson('analysis', `/indicators/${safeTicker(ticker)}`);
  }

  // F2.4 펀더멘털 기업평가 — PER/PBR/EPS/ROE/매출액/영업이익/당기순이익/부채비율/배당수익률
  @Get('fundamental/:ticker')
  fundamental(@Param('ticker') ticker: string) {
    return this.proxy.fetchJson('analysis', `/fundamental/${safeTicker(ticker)}`);
  }

  // F6.2 캔들(OHLCV) — ingest 프록시. days 쿼리(기본 30).
  @Get('candles/:ticker')
  candles(@Param('ticker') ticker: string, @Query('days') days = '30') {
    return this.proxy.candles(ticker, days);
  }

  // 대시보드 집계 스냅샷.
  @Get('dashboard/:ticker')
  dashboard(
    @Param('ticker') ticker: string,
    @Query('persona') persona = 'swing',
  ) {
    return this.proxy.dashboardSnapshot(ticker, persona);
  }

  // 종목 검색 (KRX 전종목, FinanceDataReader 기반).
  @Get('stocks/search')
  stocksSearch(
    @Query('q') q = '',
    @Query('market') market = 'all',
    @Query('limit') limit = '10',
  ) {
    return this.proxy.stocksSearch(q, market, limit);
  }

  // 단일 종목 메타 (market, name 확인용).
  @Get('stocks/:ticker')
  stockInfo(@Param('ticker') ticker: string) {
    return this.proxy.fetchJson('ingest', `/krx/stocks/${safeTicker(ticker)}`);
  }

  // Phase B-6: KRX 시장경보 목록.
  @Get('market-alerts')
  marketAlerts(@Query('ticker') ticker = '') {
    return this.proxy.marketAlerts(ticker);
  }

  // Phase B-6: 공매도 일별 통계.
  @Get('short-selling/:ticker')
  shortSelling(@Param('ticker') ticker: string) {
    return this.proxy.shortSelling(safeTicker(ticker));
  }

  // D-1/D-5: ESG 점수.
  @Get('esg/:ticker')
  esgScore(@Param('ticker') ticker: string) {
    return this.proxy.fetchJson('ingest', `/esg/${safeTicker(ticker)}`);
  }

  // D-3: 분봉 데이터.
  @Get('intraday/:ticker')
  intraday(@Param('ticker') ticker: string, @Query('interval') interval = '5m') {
    return this.proxy.intraday(ticker, interval);
  }

  // D-4: 분봉 지표.
  @Get('indicators/intraday/:ticker')
  intradayIndicators(@Param('ticker') ticker: string, @Query('interval') interval = '5m') {
    return this.proxy.fetchJson('analysis', `/indicators/intraday/${safeTicker(ticker)}?interval=${interval}`);
  }

  // C-5/D-6: 스크리너 (POST).
  @Post('screener')
  screener(@Body() body: Record<string, unknown>) {
    return this.proxy.postJson('analysis', '/screener/', body);
  }

  // F3.1 에이전트 분석 (POST).
  @Post('agents/analyze')
  agentsAnalyze(@Body() body: Record<string, unknown>) {
    return this.proxy.postJson('agents', '/agents/analyze', body);
  }

  // F5 백테스팅 — 규칙기반 전략 (sma_cross|rsi_threshold|macd_cross|qlearn).
  @Post('backtest')
  backtest(@Body() body: Record<string, unknown>) {
    return this.proxy.postJson('analysis', '/backtest/', body);
  }

  // F5 강화학습 백테스팅 — algo=DQN|PPO|A2C|QRDQN 분기.
  @Post('backtest/rl')
  backtestRl(@Body() body: Record<string, unknown>) {
    const algo = String(body.algo ?? 'DQN').toUpperCase();
    const path =
      algo === 'QRDQN' ? '/backtest/qrdqn'
      : algo === 'PPO'  ? '/backtest/dpg?mode=ppo'
      : algo === 'A2C'  ? '/backtest/dpg?mode=a2c'
      : '/backtest/dqn';
    return this.proxy.postJson('analysis', path, body);
  }

  // Phase A: 가상체결 원장 — 현재가·종목명·손익·비중 보강 후 반환.
  @Get('portfolio')
  portfolio(@Query('account') account = 'default') {
    return this.proxy.enrichPortfolio(account);
  }

  // F2.4 / F4: 펀더멘털 + 리스크 종합 평가
  @Post('risk/check')
  riskCheck(@Body() body: Record<string, unknown>) {
    return this.proxy.postJson('risk', '/risk/check', body);
  }

  // F7: 시뮬레이션 매수/매도 체결 (POST /paper/execute). ?account= 멀티계좌 지원.
  @Post('paper/execute')
  paperExecute(@Body() body: Record<string, unknown>, @Query('account') account?: string) {
    const path = account ? `/paper/execute?account=${encodeURIComponent(account)}` : '/paper/execute';
    return this.proxy.postJson('risk', path, body);
  }

  // F8: 예수금 직접 설정 (POST /paper/set-cash) — MyPage 예수금 변경 시 sync. ?account= 지원.
  @Post('paper/set-cash')
  paperSetCash(@Body() body: Record<string, unknown>, @Query('account') account?: string) {
    const path = account ? `/paper/set-cash?account=${encodeURIComponent(account)}` : '/paper/set-cash';
    return this.proxy.postJson('risk', path, body);
  }

  // F9.5 멀티계좌: 계정 목록 조회.
  @Get('paper/accounts')
  paperAccounts() {
    return this.proxy.fetchJson('risk', '/paper/accounts');
  }

  // F9.5 멀티계좌: 계정 삭제 (default 계정 불가).
  @Delete('portfolio/account/:name')
  async portfolioDeleteAccount(@Param('name') name: string) {
    return this.proxy.deleteJson('risk', `/paper/account/${encodeURIComponent(name)}`);
  }

  // D-2: IR 보고서 RAG 조회.
  @Get('rag/ir-report/:ticker')
  ragIrReport(@Param('ticker') ticker: string, @Query('k') k = '3') {
    return this.proxy.fetchJson('rag', `/rag/ir-report/${safeTicker(ticker)}?k=${k}`);
  }

  // D-2: IR 보고서 RAG 적재 (POST).
  @Post('rag/ir-report')
  ragIngestIrReport(@Body() body: Record<string, unknown>) {
    const { ticker = '', title = '', content = '' } = body as { ticker?: string; title?: string; content?: string };
    return this.proxy.fetchJson('rag', `/rag/ir-report?ticker=${encodeURIComponent(String(ticker))}&title=${encodeURIComponent(String(title))}&content=${encodeURIComponent(String(content))}`);
  }
}
