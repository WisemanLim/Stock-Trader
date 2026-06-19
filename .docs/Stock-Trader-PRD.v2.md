# Stock Trader AI Platform — PRD v2.0

> KRX Data Marketplace(data.krx.co.kr) 및 KRX OPEN API(openapi.krx.co.kr) 분석 결과를 반영한 개정판.
> 참조 분석: [krx-refer/Analysis-site.md](krx-refer/Analysis-site.md)
> 작성일: 2026-06-18

---

## 1. 제품 개요 (변경 없음)

### 1.1 배경 및 목적

주식 트레이더는 뇌동매매, 손절 타이밍 상실, 감정적 매매로 실패한다. 본 플랫폼은 스캘핑·데이 트레이딩·스윙 트레이딩·포지션 트레이딩 각 성향에 맞춤화된 전략 엔진을 제공하고, **감정 배제 기계적 손절매(Stop-loss)** 및 **리스크 한도 제어**를 실시간으로 강제하여 트레이더 생존율과 수익성을 극대화한다.

### 1.2 핵심 대상 (변경 없음)

- **스캘퍼**: 틱/초 단위, 하루 수백 회 매매
- **데이 트레이더**: 당일 전량 청산, 오버나잇 금지
- **스윙 트레이더**: 수일~수주 추세 매매
- **포지션 트레이더**: 수개월 거시/펀더멘털 기반

---

## 2. KRX 데이터 생태계 현황 분석 (신규)

### 2.1 데이터 공급원 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: 실시간 (10ms 이하 필수)                              │
│  증권사 WebSocket API (KIS·키움·대신·미래에셋)                  │
│  → 체결가, 호가창(10/20호가), 지수, 틱 데이터                  │
│  → 스캘퍼/데이트레이더 필수 경로                               │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: 일중 (분봉, 1~60분 단위)                             │
│  KRX Data Marketplace 유료 / 증권사 REST API                  │
│  → 일중 매매정보, 투자자별 순매수, 호가 스냅샷                  │
│  → 스윙 트레이더 보조                                          │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: 일별 EOD (무료, KRX OPEN API)                       │
│  https://openapi.krx.co.kr                                   │
│  → OHLCV, 종목기본정보, 투자자별 거래실적                      │
│  → 백테스팅 / 스크리너 / 포지션트레이더 분석                   │
│  데이터 범위: 2010-01-04 ~ 현재, JSON/XML                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 KRX OPEN API 커버리지 (무료)

| 자산군 | 제공 API | 비고 |
|---|---|---|
| 주가지수 | KRX/KOSPI/KOSDAQ/채권/파생상품 시리즈 일별시세 | 5개 |
| 주식 | 유가증권·코스닥·코넥스 일별매매정보 + 종목기본정보 | 8개, `stk_bydd_trd` 등 |
| 증권상품 | ETF·ETN·ELW 일별매매정보 | 3개 |
| 채권 | 국채전문·일반채권·소액채권 일별매매정보 | 3개 |
| 파생상품 | 선물/옵션 6종 일별매매정보 | 6개 |
| 일반상품 | 석유·금·배출권 일별매매정보 | 3개 |
| ESG | ESG 증권상품·사회책임투자채권·ESG 지수 | 3개 |

### 2.3 KRX Data Marketplace 유료 데이터

| 유형 | 내용 | 트레이딩 활용 |
|---|---|---|
| 호가장 | 매수/매도 10~20호가 잔량 스냅샷 | 스캘퍼 호가 분석 |
| 체결장 | 틱 단위 체결 내역 | 모든 단기 전략 |
| 일중 매매정보 | 분봉/시간봉 OHLCV | 스윙/데이트레이더 |
| 투자자별 거래실적 | 기관/외인/개인 매수매도 | 수급 분석 |
| 공매도 상세 | 개별종목 공매도 거래량 | 리스크 스크리닝 |

### 2.4 KRX 투자분석정보 (깊이 있는 통계 — 로그인 필요)

| 카테고리 | 지표 | F-매핑 |
|---|---|---|
| 가격정보 | VWAP, 체결가 상향비율, 호가 상승비율 | F2.1 기술지표 보강 |
| 거래정보 | 매수·매도 불균형, 거래회전율 | F2.3 스크리너 강화 |
| 추세정보 | 모멘텀, 맥클레란 오실레이터, 트린지수 | F2.2 시장 폭 분석 |
| 기업정보 | 실적개선 랭킹, 초과이익 지속성 | F2.3 펀더멘털 스크리너 |
| 참고정보 | 샤프비율, 투자심리선, 이벤트 효과분석 | F5 성과 보고 |

---

## 3. 현재 구현 현황 (v1 → v2 갭 분석)

### 3.1 구현 완료 현황 (PRD v1 기준)

| 기능 | 서비스 | 상태 |
|---|---|---|
| F1.1 시세·OHLCV | ingest | ✅ FinanceDataReader |
| F1.2 호가창 | ingest | ✅ 가격기반 시뮬레이션 |
| F1.2 브로커 WS | ingest | ✅ random-walk 시뮬 폴백 |
| F1.3 뉴스 RSS | ingest | ✅ feedparser |
| F1.4 FastMCP | ingest | ✅ Claude/Gemini 연동 |
| F2.1 기술지표 | analysis | ✅ RSI·MACD·Bollinger·ATR 등 |
| F2.2 예측 | analysis | ✅ LSTM·QuEST·MP팩터·FinBERT |
| F2.3 스크리너 | analysis | ✅ RSI·거래량 필터 |
| F3.1 멀티에이전트 | agents | ✅ 4개 에이전트 |
| F3.2 Quant RAG | rag | ✅ pgvector·환각차단 |
| F3.3 자가교정 | agents | ✅ 전략 드리프트 감시 |
| F4 리스크 엔진 | risk-engine | ✅ Stop-Loss·Trailing·Fail-Safe |
| F5 백테스팅 | analysis | ✅ RL(PPO/A2C)·가상체결 |
| F6.1 TUI | apps/tui | ✅ ratatui 호가창·P&L |
| F6.2 웹 대시보드 | web | ✅ Next.js + NestJS BFF · 다크/라이트 테마 · 캔들 툴팁 · 서브페이지 · **전체 UI 40개 항목 인라인 툴팁** |
| F6.3 알림/제어 | agents | ✅ Telegram/Discord·긴급청산 |

### 3.2 KRX 분석 기반 갭 (v1 → v2 수정/보완 목표)

| 갭 항목 | 우선순위 | 현재 상태 | 목표 |
|---|---|---|---|
| **G1** KRX OPEN API 통합 | 🔴 HIGH | FinanceDataReader 의존 | KRX OpenAPI 1차 소스화 |
| **G2** 실 브로커 WebSocket 연동 | 🔴 HIGH | random-walk 시뮬 | KIS/키움 실 WS 연동 |
| **G3** 투자자별 거래실적 (기관/외인) | 🔴 HIGH | 미구현 | KRX API or 브로커 API |
| **G4** 공매도 데이터 통합 | 🟠 MEDIUM | 미구현 | KRX 공매도 통계 |
| **G5** KRX 투자분석정보 연동 | 🟠 MEDIUM | 미구현 | VWAP·매수매도불균형 |
| **G6** 기업 AI 분석보고서 연동 | 🟠 MEDIUM | 미구현 | IR협의회 AI 보고서 |
| **G7** 분봉/일중 데이터 파이프라인 | 🔴 HIGH | 일봉만 | 1분봉/5분봉 수집 |
| **G8** ESG 데이터 레이어 | 🟡 LOW | 미구현 | 포지션 트레이더용 |
| **G9** 시장경보종목 자동 필터 | 🔴 HIGH | 미구현 | 투자주의/경고/위험 자동 차단 |
| **G10** 종목 스크리너 확대 | 🟠 MEDIUM | RSI·거래량만 | 80개 이상 재무 필터 |

---

## 4. 핵심 기능 요구사항 v2 (수정/보완)

### F1. 시장 데이터 및 환경 분석 모듈 (Data Ingestion) — 대폭 보강

#### F1.1 실시간 시세 파이프라인 (보완)

**현재**: FinanceDataReader + random-walk 시뮬레이터  
**목표**: 계층형 데이터 소스 아키텍처

```
[KRX OPEN API]  ──→ 일별 OHLCV (백테스팅 DB 적재)
[증권사 WS API]  ──→ 실시간 체결가·틱 (ingest 스트림)
[Fallback]       ──→ random-walk 시뮬 (개발/테스트 전용)
```

- **KRX OPEN API 1차 적재**: `stk_bydd_trd`(유가증권), `ksq_bydd_trd`(코스닥) 일별 배치 수집. 2010년 이후 전체 히스토리 적재.
- **실 브로커 WebSocket**: KIS Open API (`h0stasp0`, `h0stcnt0` 등 체결/호가 구독). 폴백 시뮬레이터 유지.
- **데이터 계층 분리**: TimeSeries DB(일별) vs StreamBuffer(실시간)

#### F1.2 호가창 데이터 (보완)

- **10/20호가 실 데이터**: 브로커 WebSocket 10호가 구독 우선. KRX 유료 호가장은 선택적 옵션.
- **Order Flow 분석**: 호가 잔량 변화 속도, 매수/매도 벽 감지 알고리즘 추가

#### F1.3 비정형 데이터 크롤러 (보완)

| 소스 | 현재 | 추가 |
|---|---|---|
| 뉴스 RSS | ✅ | MarketWatch, Reuters, 연합인포맥스 |
| 기업공시 | - | DART(KIND) 실시간 공시 수신 |
| KRX 시장경보 | - | 투자주의/경고/위험/정리매매 종목 자동 수신 |
| 투자분석정보 | - | VWAP, 매수매도불균형(KRX 스크래핑 or 유료) |
| 공매도 | - | KRX 공매도 일별 통계 적재 |

#### F1.5 KRX OPEN API 전용 수집기 ✅ (iter-27 구현 완료)

- **API Key 관리**: OS Keychain 저장, `.env` 기재 금지 — `KRX_OPEN_API_KEY` 환경변수 주입
- **2단계 호출**: `GenerateOTP.jspx` → `jsonSvr.do`, Rate Limit `KRX_API_RATE_LIMIT`(기본 0.5s)
- **API ID**: KOSPI=`stk_bydd_trd` / KOSDAQ=`ksq_bydd_trd` / KONEX=`knx_bydd_trd`
- **투자자 수급**: `stk_invsr_trd_by_isu` (기관/외국인/개인 순매수)
- **미설정 폴백**: API Key 미설정 시 빈 결과 반환 → FinanceDataReader 폴백 유지
- **REST 엔드포인트**: `GET /krx/status` · `/krx/ohlcv/{ticker}` · `/krx/investor-flow/{ticker}`
- ⏳ **일별 배치 스케줄러**: 15:40 이후 전종목 자동 적재 (Phase A 잔여)
- ⏳ **데이터 정합성 검증**: 수집 후 이상값 자동 탐지 (Phase A 잔여)

---

### F2. 기술적/기본적 분석 및 시계열 예측 (보완)

#### F2.1 기술지표 (보완)

**현재**: RSI·MACD·Bollinger·EMA·SMA·ATR  
**추가**:
- **KRX 제공 지표 내재화**: VWAP(체결량 가중 평균가), 체결가 상향비율, 최우선호가 상승비율
- **시장 폭(Breadth) 지표**: 맥클레란 오실레이터, 트린지수, ADL(등락선)
- **공매도 보조 지표**: 공매도 비율, 대차잔고 증감 추이

#### F2.2 시계열 예측 (보완)

**추가 입력 피처**:
- 투자자별 순매수(기관/외인/개인) 일별 플로우
- 공매도 잔고 증감
- 시장경보 지정 이력(투자주의→경고→위험 단계 인코딩)

#### F2.3 종목 스크리너 (보완)

**현재**: RSI·거래량 필터  
**확대**:
- **재무 필터 80종**: PER, PBR, ROE, 부채비율, 영업이익 증가율 등 (KRX 기업정보 or KIND 공시)
- **수급 필터**: 외국인보유 비율, 기관 순매수 연속일, 공매도 비율 임계치
- **시장경보 차단 필터**: 투자경고/위험 종목 자동 제외
- **공매도 과열 필터**: 공매도 과열 지정 종목 자동 경고

---

### F3. LLM/멀티에이전트 기반 자율 거래 (보완)

#### F3.1 멀티에이전트 협업 체계 (보완)

**기존 4 에이전트 유지 + 추가**:

5. **시장경보 에이전트(Market Alert Agent)** (신규)
   - KRX 시장경보 종목(투자주의/경고/위험/정리매매) 실시간 모니터링
   - 보유 중인 경보 종목 발견 시 Decision Agent에 즉시 청산 트리거
   - 신규 진입 후보 종목의 경보 상태 사전 필터링

6. **수급 분석 에이전트(Flow Agent)** (신규)
   - 투자자별 거래실적(기관/외인/개인) 수급 패턴 분석
   - 외국인 연속 순매수/순매도 패턴 감지
   - 공매도 급증 종목 리스크 경보

#### F3.2 Quant RAG (보완)

**추가 문서 소스**:
- KRX 간행물(통계월보, KRX MARKET, KRX ETF·ETN MONTHLY)
- 한국IR협의회 기업분석보고서(AI 분석보고서 포함)
- KRX 공매도 관련 규제 문서(제도·법령체계)
- 마이데이터 2.0·전자금융감독규정 최신 개정본

#### F3.4 기업분석 보고서 에이전트 (신규)

- 한국IR협의회 AI기업분석보고서 자동 수집 및 RAG 적재
- 분기 실적 공시(DART) 자동 파싱 → 포지션 트레이더용 재무 이상값 탐지
- KRX 깊이 있는 통계 > 기업분석보고서 주기적 수집

---

### F4. 리스크 관리 및 거래 체결 규칙 (보완)

#### F4.1 감정 배제 기계적 리스크 엔진 (현재 유지 + 보완)

**기존 유지**: Stop-Loss, Trailing Stop, Take-Profit  
**추가**:

- **시장경보 긴급 청산 트리거**: 보유 종목이 투자경고 또는 투자위험 지정 시 즉시 시장가 청산 (위험도 2단계 이상)
- **공매도 과열 포지션 축소**: 보유 종목의 공매도 비율이 임계치(예: 15%) 초과 시 포지션 50% 자동 축소
- **정리매매 자동 처리**: 보유 종목 상장폐지 결정 즉시 전량 청산

#### F4.2 일일 누적 손실 한도 (현재 유지)

#### F4.3 포지션 사이징 (보완)

- **유동성 기반 조정**: 평균 거래량 대비 목표 포지션 비율 5% 이내 (KRX 일별 거래량 기반)
- **공매도 비율 반영**: 공매도 비율 높은 종목 포지션 자동 감소

#### F4.4 Fail-Safe 모드 (보완)

**추가 트리거**:
- KRX OPEN API 응답 실패 30초 지속 → 신규 진입 차단
- 브로커 WebSocket 세션 단절 → 즉시 Fail-Safe 전환 (기존 유지)
- 시장 전체 서킷브레이커 감지 → 전 포지션 모니터링 강화

---

### F5. 백테스팅 및 전략 평가 시뮬레이터 (보완)

#### F5.1 강화학습 기반 시뮬레이터 (보완)

**데이터 품질 향상**:
- **KRX OPEN API 기반 히스토리**: 2010년 이후 OHLCV + 투자자별 거래실적 통합
- **공매도 데이터 반영**: 공매도 비율을 백테스팅 환경 피처로 추가
- **시장경보 이력 반영**: 투자주의/경고 종목 지정 이력을 시뮬레이션에 반영하여 현실성 제고

#### F5.2 전략 성과 보고 (보완)

**추가 지표**:
- **공매도 노출도**: 보유 기간 중 평균 공매도 비율
- **수급 적합성 점수**: 기관/외인 방향성과 전략 방향 일치율
- **시장경보 회피율**: 경보 종목 편입 방지 성공률

#### F5.3 백테스팅 히스토리 시각화 (보완)

- KRX 투자분석정보 이벤트 효과분석 데이터 오버레이
- 공시(DART) 이벤트 차트 마킹

---

### F6. 사용자 인터페이스 (보완)

#### F6.1 TUI (보완)

**추가 패널**:
- 시장경보 종목 실시간 배너(빨간 텍스트 하이라이트)
- 공매도 비율 표시 (호가창 옆 컬럼)
- 투자자별 순매수 미니 위젯 (기관/외인/개인)

#### F6.2 웹 대시보드 (보완)

**Phase 0 완료 (차수26)**:
- **F6.2.1 다크/라이트 테마 전환** ✅ — TopBar 버튼(☀/◑), `localStorage` 영속, `[data-theme="light"]` CSS 변수 오버라이드
- **F6.2.2 캔들차트 마우스오버 툴팁** ✅ — 날짜·O·H·L·C·거래량·등락률, 우측 경계 자동 flip, SVG 좌표계 스케일 보정
- **F6.2.3 시계 실시간 갱신** ✅ — 1초 interval, 서버 렌더 고정값 → 클라이언트 틱
- **F6.2.4 서브 페이지 라우트** ✅ — `/portfolio` `/strategy` `/risk` `/backtest` `/agents` 플레이스홀더 (404 해소)

**iter-28 완료**:
- **F6.2.5 전체 UI 인라인 툴팁** ✅ — `Tooltip` 컴포넌트(position:fixed · 260ms delay · viewport flip) + `TOOLTIPS` 사전
  - 커버리지: 페르소나 4 · 메뉴 6 · 서비스 상태 4 · 지표 행 6 · MetricCard 5 · 패널 제목 7 · 리스크 행 3 · 수급 행 3 · KOSPI/페르소나 배지 2 = **40개 항목**
  - 각 항목: (전략)·(특징)·(파라미터) 구조, 계산식·해석·활용법 포함 상세 한국어 설명

**iter-29 완료**:
- **F6.2.6 툴팁 뷰포트 방어** ✅ — ref 높이 측정 후 하단 초과 시 커서 위로 flip (상하·좌우 모두 방어)
- **F6.2.7 기업명/코드 통합 검색** ✅ — `lib/stocks.ts` (KOSPI+KOSDAQ 165종목 정적 목록) + `searchStocks()`
  - 숫자 입력 → ticker startsWith · 문자 입력 → 기업명 contains
  - TopBar autocomplete 드롭다운: ↑↓ 탐색 · Enter 선택 · Escape 닫기 · blur 150ms 지연
- **F6.2.8 캔들 차트 X/Y축·반응형·줌** ✅
  - Y축: nice interval 가격 눈금(1·2·2.5·5·10×10^n), K/M/천단위 레이블
  - X축: MM/DD 날짜 레이블 (최대 chartW/60개)
  - 반응형: `ResizeObserver` → SVG 폭 자동 동기화
  - 스크롤 줌: 휠 위=줌인(봉-5) · 아래=줌아웃(봉+5) · 범위 10봉~전체봉

**미구현 (Phase A~C)**:
- **KRX 연동 위젯**: 공매도 현황, 투자자별 거래실적, 시장경보 목록
- **종목 스크리너 UI**: 80종 재무 필터 + 수급 필터 UI
- **ESG 대시보드**: 포지션 트레이더용 ESG 등급 표시
- **포트폴리오 페이지**: 가상체결 원장 연동, 손익곡선 차트
- **백테스팅 UI**: 전략 선택·파라미터 입력·결과 시각화

#### F6.3 알림 채널 (현재 유지)

- Telegram/Discord 양방향 제어 유지
- **추가**: 시장경보 지정 즉시 Push 알림

#### F6.2.9 상단바 종목코드+기업명 표시 ✅ (iter-35 구현)

- TopBar 검색 영역 오른쪽에 현재 조회 종목 코드+기업명 표시
- `localStorage(st_ticker, st_name)` 영속: 대시보드 → 서브페이지 이동 후에도 유지
- 정적 165종목 미포함 코드는 BFF `/api/stocks/:ticker` 동적 조회로 이름 보완
- mounted 플래그로 SSR 하이드레이션 오류 방지

#### F6.2.10 서브페이지 종목 컨텍스트 유지 ✅ (iter-35 구현)

- 리스크(`/risk`), 백테스팅(`/backtest`), 에이전트(`/agents`) 페이지에서 대시보드 선택 종목을 기본값으로 사용
- 각 페이지 내 종목코드 입력 옆에 기업명 표시
- 별도 종목 조회 시 해당 종목으로 변경 (리스크 페이지)

#### F6.2.11 4분면 캔들 차트 ✅ (iter-36/37 구현)

- 기존 단일 캔들 차트를 2×2 그리드(`CandleChart4.tsx`)로 교체
- Q1 (좌상): 금일 5분봉 선형 차트 (실시간 폴링; 장마감 후 최근 거래일 데이터 표시)
- Q2 (우상): 시간대별 평균 수익률 바 차트 (9~15시, 5분봉 → 일별 개장가 대비 누적 수익률 집계)
- Q3 (좌하): 요일별 평균 수익률 바 차트 (90일 일봉 기준, 월~금)
- Q4 (우하): 기존 일봉 캔들 차트 (줌·툴팁 유지)
- 각 사분면 구분선 1px solid, 높이 330px × 2행(총 660px)
- **모든 차트 마우스 휠 줌 지원** — Q1: 봉 수(X축 줌), Q2/Q3: Y축 배율 줌
- **X축·Y축 레이블 표시** — 모든 사분면 가격/퍼센트/시각 눈금
- **사분면 클릭 시 팝업 확대** — ⛶ 버튼 → Modal 오버레이(1280×680px, ESC 닫기)
- intraday fallback 개선: 일봉 open→close 선형 보간으로 시간대별 수익률 계산 가능하도록 수정

#### F6.2.12 상단 종목조회 히스토리 ✅ (iter-40 구현)

- **위치**: TopBar 종목코드 입력 필드
- **동작**: 입력 필드 포커스 + 빈 입력 → "최근 조회" 드롭다운 자동 표시
- **히스토리 저장**: 조회/선택 시 `localStorage` 키 `st_ticker_history_{userId}` 에 저장 (사용자별 격리)
- **표시 형식**: 🕐 종목코드(청색 mono) + 기업명, 최대 10건 최신순
- **삭제**: 항목별 ×버튼(단건) + "전체 삭제" 버튼
- **모드 분기**: 빈 입력 → 히스토리; 텍스트 입력 → 기존 자동완성(변경 없음)
- **빈 dropdown 방어**: 히스토리 0건 + 자동완성 0건이면 드롭다운 비표시

---

### F7. 시뮬레이션 매수/매도 (신규, iter-35)

#### F7.1 요구사항

| 항목 | 내용 |
|------|------|
| 목적 | SIMULATION 모드에서 실제 매수/매도 흐름을 확인하여 전략 추세 검증 |
| 위치 | 대시보드 하단 패널 (캔들차트 아래 3-col row 내 3번째 열) |
| 체결 방식 | risk-engine `POST /paper/execute` → BFF `POST /api/paper/execute` 프록시 |
| 포트폴리오 반영 | 체결 후 `/portfolio` 페이지에서 조회 가능 |

#### F7.2 구현 사양 ✅

- `components/SimulationPanel.tsx` — 수량 입력 + 매수(▲)/매도(▼) 버튼 + 체결 결과 표시
- 수량 × 현재가 = 예상 금액 실시간 표시
- 체결 성공 시: `✓ 매수/매도 {n}주 @ {price}원` 확인 메시지
- risk-engine 미기동 시 에러 메시지 표시 (graceful degradation)
- BFF `POST /api/paper/execute` → risk-engine `POST /paper/execute` 신규 라우트

#### F7.3 SIMULATION 모드 예수금 추적 ✅ (iter-36 구현)

| 항목 | 내용 |
|------|------|
| 초기 예수금 | 10,000,000원 (1천만원) — `INITIAL_CASH` 상수 |
| 매수 차감 | `cash -= fill_price × quantity + fee` |
| 매도 가산 | `cash += fill_price × quantity - fee` |
| 포트폴리오 반영 | `GET /paper/portfolio` 응답에 `cash` 필드 추가 |
| 포트폴리오 UI | 예수금·총 평가금액(주식 평가액 + 예수금) 카드 표시 |

- Rust `PaperBook.cash` 필드 추가 (`core/risk-engine/src/paper.rs`)
- `commit()` 에서 체결 후 예수금 실시간 반영
- 포트폴리오 페이지: BFF 에서 현재가·종목명·손익·비중 보강 후 반환

#### F7.4 수량 입력 UX 개선 + 예수금 검증 ✅ (iter-40 구현)

| 항목 | 내용 |
|------|------|
| 입력 방식 | `type="text" inputMode="numeric"` — 숫자 자유 입력, 브라우저 spin버튼 제거 |
| 포커스 동작 | `onFocus: select()` — 포커스 시 전체 선택 → 즉시 덮어쓰기 |
| 0 수량 방어 | qty=0 시 매수/매도 클릭 → `alert('수량을 입력해주세요.')` 후 중단 |
| 예수금 조회 | 컴포넌트 마운트 시 `GET /api/portfolio` → `cash` 필드 표시 |
| 예수금 부족 | 매수 합계 > 잔액 → `alert('예수금이 부족합니다. 필요/잔액')` 후 중단 |
| 백엔드 이중 검증 | 프론트 통과 후 risk-engine 거부(`accepted:false`) + `reason` 키워드 매칭 시 추가 alert |
| 체결 후 갱신 | 체결 성공 시 예수금 재조회하여 잔액 실시간 반영 |

---

## 5. 거래 성향별 KRX 데이터 활용 전략 (갱신)

| 페르소나 | KRX OPEN API 활용 | 추가 데이터 소스 | 핵심 신규 기능 |
|---|---|---|---|
| **스캘퍼** | 종목기본정보(종목코드 조회) | 브로커 WS 틱/호가(필수) | 호가 잔량 속도 분석, 체결가 상향비율 실시간 |
| **데이 트레이더** | 일별 OHLCV(전략 검증) | 브로커 WS 체결·5분봉 | 투자자별 순매수 방향, 시장경보 자동 차단 |
| **스윙 트레이더** | 투자자별 거래실적, 공매도 일별 | 일중 매매정보(유료/브로커) | 수급 분석 에이전트, ATR+공매도 통합 리스크 |
| **포지션 트레이더** | 종목기본정보, ESG 지수, 채권 | KRX 기업분석보고서, DART | 기업분석 에이전트, ESG 데이터 레이어 |

---

## 6. 시스템 아키텍처 v2 (개정)

### 6.1 데이터 흐름 설계 (갱신)

```
┌──────────────────────────────────────────────────────────────┐
│                    Ingestion Phase (F1)                       │
│                                                               │
│  [KRX OPEN API]────────┐                                     │
│    일별 OHLCV·기본정보   │                                     │
│    투자자별거래실적       │──→ [ingest :8003]──→ PostgreSQL    │
│    공매도 일별 통계       │       ↓                            │
│                         │   Redis StreamBuffer                │
│  [증권사 WebSocket]──────┘       ↑                            │
│    틱·호가창·체결장            브로커 WS 실시간               │
│                                                               │
│  [DART/KIND 공시]───────────→ [ingest :8003]                 │
│  [KRX 시장경보]─────────────→ [ingest :8003]                 │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│                  Processing Phase (F2)                        │
│  [analysis :8001]                                             │
│  기술지표(VWAP·Breadth 추가) + 예측 + 스크리너(80필터)          │
│  공매도·수급 피처 통합                                          │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│                Agent Logic Phase (F3)                         │
│  [agents :8004]                                               │
│  6개 에이전트: Scraper·Analyst·Portfolio·Decision             │
│             + MarketAlert(신규)·Flow(신규)                    │
│  RAG: KRX 간행물·IR분석보고서·공매도 규제 문서 추가             │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│                  Risk Audit Phase (F4)                        │
│  [risk-engine :3001] Rust/Axum                               │
│  Stop-Loss·Trailing·일일한도·포지션사이징·Fail-Safe            │
│  + 시장경보 긴급청산·공매도과열 포지션축소(신규)                 │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│                 Execution Phase (가상 체결)                    │
│  가상(시뮬레이션) 체결 → append-only 원장 기록                   │
│  Telegram/Discord 알림 + 긴급 제어                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 KRX OPEN API 수집기 아키텍처 (신규 컴포넌트)

```python
# services/ingest/app/krx/
# ├── client.py          # KRX OpenAPI HTTP 클라이언트 (API Key: OS Keychain)
# ├── scheduler.py       # 매일 15:40 일별 배치 스케줄러
# ├── collector.py       # 자산별 수집 로직 (주식/지수/파생/채권/ESG)
# ├── validator.py       # 수집 후 종목 수·필드 이상값 검증
# └── market_alert.py    # 시장경보 종목 폴링 (KRX 통계 스크래핑 or 유료 API)
```

---

## 7. 비기능 요구사항 (v2 갱신)

| 항목 | 현재 기준 | v2 목표 | 비고 |
|---|---|---|---|
| 주문 판단→송출 지연 | 10ms 이내 | 10ms 이내 유지 | risk-engine Rust |
| KRX API 배치 수집 | 없음(FDR) | 15:40 이후 30분 이내 완료 | 전종목 일별 |
| 브로커 WS 재연결 | 시뮬 폴백 | 3초 이내 재연결, 5회 실패 시 Fail-Safe | |
| 시장경보 반영 지연 | 없음 | 수신 후 1분 이내 Risk Engine 반영 | |
| 보안 (API Key) | Vault/Keychain | Vault/Keychain 유지 + KRX API Key 분리 관리 | 코드 노출 금지 |
| 데이터 보존 | 없음 명시 | 일별 데이터 10년 이상 보존(2010~) | PostgreSQL partitioning |

---

## 8. 수정/보완 로드맵 (v2 마일스톤)

> 현재 시험 25차 완료 기준. 이하 v2 마일스톤은 순차 진행.

### Phase 0 — 웹 대시보드 UI 재설계 (**현재 진행**)

**목표**: 현재 인라인 스타일 기반 단일 페이지를 트레이딩 터미널 스타일 다크 UI로 전환

**현황**:
- `layout.tsx`: 스타일 없음, 내비게이션 없음
- `page.tsx`: 인라인 스타일 카드 4개 + 캔들 차트
- Tailwind v4 설치되어 있으나 미적용
- CSS 파일 없음, 컴포넌트 분리 없음

| 작업 | 내용 | 파일 |
|---|---|---|
| 0-1 Tailwind v4 PostCSS 설정 | `@tailwindcss/postcss` + `globals.css` | `postcss.config.mjs`, `app/globals.css` |
| 0-2 레이아웃 구조 재설계 | TopBar + Sidebar + 메인 콘텐츠 3분할 | `app/layout.tsx` |
| 0-3 Sidebar 컴포넌트 | 6개 메뉴 + 페르소나 선택 + 서비스 상태 표시 | `components/Sidebar.tsx` |
| 0-4 TopBar 컴포넌트 | 로고, 종목 검색, 실시간 지수, 상태 인디케이터 | `components/TopBar.tsx` |
| 0-5 메인 대시보드 재설계 | 메트릭 카드 + 캔들 차트 + 지표 패널 그리드 | `app/page.tsx` |
| 0-6 CandleChart 다크 테마 | SVG 색상·배경 다크 터미널 스타일 적용 | `components/CandleChart.tsx` |

**디자인 방향**:
- **테마**: 다크 트레이딩 터미널 (Bloomberg/TradingView 스타일)
- **배경**: `#0d1117` (딥 다크) / 카드: `#1c2128` / 테두리: `#30363d`
- **텍스트**: `#e6edf3` (프라이머리) / `#8b949e` (세컨더리)
- **상승**: `#3fb950` (녹색) / **하락**: `#f85149` (적색) / **강조**: `#58a6ff` (청색)
- **레이아웃**: 좌측 사이드바(200px) + 상단 바(48px) + 메인 그리드

**완료 기준**: `pnpm dev` 실행 후 브라우저에서 다크 터미널 UI 확인. TopBar·Sidebar 렌더링 정상. Tailwind 클래스 적용.

---

### Phase A — 데이터 소스 강화 (우선순위 최상)

**목표**: KRX 공식 데이터를 1차 소스로 교체하고 실 브로커 연동 준비

| 작업 | 갭 | 서비스 | 예상 규모 |
|---|---|---|---|
| A-1 KRX OPEN API 클라이언트 구현 | G1 | ingest | ✅ iter-27 완료 |
| A-2 일별 배치 스케줄러 + DB 스키마 확장 | G1 | ingest | ✅ iter-30 완료 (APScheduler 15:40 KST, OhlcvDaily/InvestorFlowDaily) |
| A-3 2010년 이후 전체 히스토리 초기 적재 | G1 | ingest | 1일 |
| A-4 KIS Open API WebSocket 실 연동 모듈 | G2 | ingest | 4일 |
| A-5 브로커 WS Fail-Safe + 재연결 핸들러 | G2 | ingest | 1일 |
| A-6 투자자별 거래실적 수집 + DB 적재 | G3 | ingest | ✅ iter-27 부분 완료 (REST 엔드포인트, DB 적재 잔여) |

**완료 기준**: KRX OPEN API로 전종목 일별 데이터 자동 수집. 실 브로커 WS에서 체결가 수신.

---

### Phase B — 리스크 강화 + 시장경보 (우선순위 높음)

**목표**: 시장경보·공매도 기반 리스크 자동화

| 작업 | 갭 | 서비스 | 예상 규모 |
|---|---|---|---|
| B-1 KRX 시장경보 종목 수집기 | G9 | ingest | ✅ iter-31 완료 (KrxMarketAlertService, MarketAlertDaily, /krx/market-alerts) |
| B-2 시장경보 긴급청산 트리거 (Rust) | G9 | risk-engine | ✅ iter-32 완료 (market_alert_level≥3→ForceSell, =2→BlockBuy, /risk/alert-check) |
| B-3 공매도 일별 통계 수집 | G4 | ingest | ✅ iter-31 완료 (ShortSellingDaily, /krx/short-selling, KRX OPEN API stk_smls_trd_by_isu) |
| B-4 공매도 과열 포지션 축소 로직 | G4 | risk-engine | ✅ iter-32 완료 (short_ratio>short_ratio_limit→ReducePosition) |
| B-5 TUI 시장경보 배너 + 공매도 컬럼 | G9, G4 | apps/tui | ✅ iter-32 완료 (AlertItem, 4단 레이아웃, 색상코딩, 공매도 비율 헤더) |
| B-6 웹 대시보드 시장경보 위젯 | G9, G4 | web | ✅ iter-32 완료 (레벨 배지, 종목 목록, 공매도 비율 표, graceful fallback) |

**완료 기준**: 시장경보 종목 보유 시 1분 이내 자동 청산 트리거. 공매도 과열 경보 시 포지션 자동 조정.

---

### Phase C — 분석 강화 ✅ 완료

**목표**: 투자분석 지표 확대 + 스크리너 80종 필터

| 작업 | 갭 | 서비스 | 상태 |
|---|---|---|---|
| C-1 VWAP(20)·close_pct 지표 추가 | G5 | analysis | ✅ |
| C-2 시장 폭(Breadth) 지표 (트린·ADLine) | G5 | analysis | ✅ |
| C-3 수급 분석 에이전트(FlowAgent) | G3 | agents | ✅ |
| C-4 시장경보 에이전트(AlertAgent) | G9 | agents | ✅ |
| C-5 스크리너 확대 (80종, signal/close/limit 필터) | G10 | analysis | ✅ |
| C-6 공매도 비율(max_short_ratio) 스크리너 필터 | G4 | analysis | ✅ |

**완료 기준**: ✅ 80종 재무 필터 동작. ✅ 수급 에이전트 기관/외인 방향성 신호 생성. ✅ VWAP 실시간 계산.

---

### Phase D — 고도화 ✅ 완료

**목표**: ESG 레이어, AI 기업분석, 분봉 데이터

| 작업 | 갭 | 서비스 | 상태 |
|---|---|---|---|
| D-1 KRX ESG 지수/증권상품 API 연동 | G8 | ingest | ✅ `GET /esg/{ticker}` E/S/G 프록시 점수 |
| D-2 한국IR협의회 AI 분석보고서 RAG 적재 | G6 | rag | ✅ `POST/GET /rag/ir-report` 벡터스토어 |
| D-3 분봉(1분/5분) 데이터 수집 | G7 | ingest | ✅ `GET /market/intraday/{ticker}?interval=` FDR+fallback |
| D-4 분봉 기반 기술지표 계산 파이프라인 | G7 | analysis | ✅ `GET /indicators/intraday/{ticker}` RSI/MACD/VWAP |
| D-5 웹 대시보드 ESG 위젯 | G8 | web | ✅ page.tsx ESG 패널 (E/S/G 바 차트) |
| D-6 포지션 트레이더 ESG 필터 스크리너 | G8 | analysis | ✅ `min_esg_score` 필터 추가 |

**서브페이지 연결** (iter-34 추가):
| 페이지 | 연결 API | 상태 |
|---|---|---|
| 전략 (`/strategy`) | `POST /api/screener` — RSI/시그널/ESG/공매도 필터 | ✅ |
| 에이전트 (`/agents`) | `POST /api/agents/analyze` — 6-에이전트 파이프라인 | ✅ |
| 백테스팅 (`/backtest`) | `POST /api/backtest` — 전략선택/기간/결과 차트 | ✅ |
| 리스크 (`/risk`) | `GET /api/market-alerts`, `GET /api/short-selling/:ticker` | ✅ |
| 포트폴리오 (`/portfolio`) | `GET /api/portfolio` — risk-engine paper 원장 | ✅ |

**완료 기준**: ESG 데이터 포함 포지션 트레이더 전략 백테스팅. 분봉 기반 스윙 트레이더 지표 동작. ✅ 달성

---

## 8. F8 — 사용자 인증 (Auth)

### F8.1 회원가입 (`/register`)

| 항목 | 규격 |
|---|---|
| 입력 필드 | 이메일, 성명, 비밀번호(8자↑), 비밀번호 확인, 예수금(기본 1억 KRW, `type=number` 입력 — 포맷 커서 리셋 버그 방지) |
| TOTP 설정 | 회원가입 완료 후 QR코드 표시 → 앱 스캔 → 6자리 코드 확인 → 활성화(나중에 설정 가능) |
| 중복 검사 | 이메일 unique 제약, 409 Conflict 반환 |
| 즉시 활성 | 승인 워크플로 없이 가입 즉시 활성 |

### F8.2 로그인 (`/login`)

| 항목 | 규격 |
|---|---|
| 인증 방식 | 이메일 + 비밀번호 (bcrypt-12) |
| TOTP 2FA | `totp_enabled=true` 사용자: TOTP 코드 추가 입력 |
| JWT | HS256, 7일 만료, `AUTH_JWT_SECRET` 환경 변수 |
| 세션 저장 | `localStorage st_token / st_user` (클라이언트 전용) |

### F8.3 AuthGuard (라우팅 보호)

- `/login`, `/register` 이외 모든 경로: `localStorage` 토큰 없으면 `/login` 리다이렉트
- `ClientLayout` 클라이언트 컴포넌트에서 마운트 시 토큰 검사

### F8.4 마이페이지 (Sidebar 롤업 패널)

| 항목 | 규격 |
|---|---|
| 진입 | 사이드바 하단 사용자 이름 클릭 → `MyPagePanel` 슬라이드업 |
| 비밀번호 변경 | 현재 비밀번호 확인 후 새 비밀번호(8자↑) 변경 |
| 예수금 변경 | 시뮬레이션 초기 예수금 수정 (DB + localStorage 동기) |
| TOTP 등록 | QR 코드 재생성 → 6자리 코드 확인 → 활성화 |

### F8.5 로그아웃

- 사이드바 하단 "⎋ 로그아웃" 클릭 → `clearSession()` → `/login` 리다이렉트

### F8.6 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 회원가입 (이메일·성명·비밀번호·예수금) |
| POST | `/api/auth/login` | 로그인 (이메일·비밀번호·TOTP?) |
| GET | `/api/auth/me` | 현재 사용자 정보 (Bearer JWT) |
| POST | `/api/auth/change-password` | 비밀번호 변경 |
| POST | `/api/auth/change-cash` | 예수금 변경 |
| GET | `/api/auth/totp/qr` | TOTP QR코드 생성 |
| POST | `/api/auth/totp/enable` | TOTP 활성화 (코드 확인) |

### F8.7 기술 스택

| 항목 | 기술 |
|---|---|
| DB | SQLite (`node:sqlite` Node 24 내장) — `web/apps/dashboard/data/auth.db` |
| HMR 싱글톤 | `globalThis.__authDb` 패턴 — Next.js 핫리로드 시 DB 커넥션 유지 |
| 비밀번호 해시 | `bcryptjs` (rounds=12) |
| JWT | `jose` HS256 7일 |
| TOTP | `otplib` (RFC 6238 TOTP) + `qrcode` QR 생성 |
| 구현 위치 | Next.js App Router Route Handlers (`app/api/auth/*`) |

> **보안**: `AUTH_JWT_SECRET` 환경 변수 필수. 파일 저장 금지 (Keychain/Vault 주입).
> `data/*.db` `.gitignore` 적용.

### F8.8 운영 명령

| 명령 | 설명 |
|---|---|
| `make db-reset` | 인증 DB 삭제(`data/auth.db`) — 전체 사용자 초기화. 다음 기동 시 스키마 자동 재생성 |

---

## 9. 참고 오픈소스 및 KRX 데이터 매핑 (v2 갱신)

| 오픈소스 | KRX 데이터 연동 포인트 |
|---|---|
| `freqtrade/freqtrade` | KRX OPEN API → FinanceDataReader 대체 후 전략 파이프라인 동일 적용 |
| `microsoft/qlib` | KRX 일별·투자자별 데이터 → 알파 팩터 피처 엔지니어링 |
| `TauricResearch/TradingAgents` | 수급 분석 에이전트, 시장경보 에이전트 설계 참고 |
| `FinanceData/FinanceDataReader` | KRX OPEN API로 1차 교체, FDR은 해외 데이터 폴백 유지 |
| `atilaahmettaner/tradingview-mcp` | Bollinger/RSI MCP + VWAP·Breadth 지표 확장 |
| `Y-Research-SBU/QuantAgent` | 시장경보·공매도 기반 전략 드리프트 감시 강화 |
| `AI4Finance-Foundation/FinRobot` | IR협의회 AI 분석보고서 → RAG 연동 |

---

## 10. 규제 준수 (COMPLIANCE 보완)

| 항목 | v1 | v2 추가 |
|---|---|---|
| KRX API Key 관리 | OS Keychain/Vault | KRX OPEN API Key 별도 시크릿 슬롯 분리 |
| 시장경보 준수 | 없음 | 투자위험 종목 자동 청산(규제 리스크 차단) |
| 마이데이터 2.0 | ISMS-P 준수 | KRX 투자분석정보 이용 약관 준수 |
| 공매도 규제 | 없음 | KRX 공매도 제도 규정 RAG 적재 |
| 데이터 이용약관 | 없음 명시 | KRX 마켓데이터 이용약관 준수 (비상업적 무료 OPEN API) |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.0 | (초기) | 최초 작성 — 20선 오픈소스 기반 설계 |
| v2.0 | 2026-06-18 | KRX Data Marketplace 분석 반영. 데이터 계층 구조 재설계. 시장경보·공매도·수급 에이전트 추가. KRX OPEN API Phase A~D 로드맵 수립. |
| v2.1 | 2026-06-18 | A-2 완료(배치 스케줄러+DB). B-1 완료(시장경보 수집기). B-3 완료(공매도 통계). 종목 DB 동적화(FDR 전종목·KOSPI/KOSDAQ badge). |
| v2.2 | 2026-06-18 | Phase B 완성. B-2(긴급청산 트리거 Rust). B-4(공매도 과열 포지션 축소). B-5(TUI 시장경보 배너). B-6(웹 대시보드 실데이터 연결). MACD 지표 타입 버그 수정. |
| v2.3 | 2026-06-18 | Phase C 완성. C-1(VWAP·close_pct). C-2(Breadth: TRIN·ADLine). C-3(FlowAgent 수급분석). C-4(AlertAgent 경보 override). C-5(80종 signal/close 필터). C-6(max_short_ratio). 6-에이전트 파이프라인. 대시보드 VWAP 패널. |
| v2.4 | 2026-06-18 | Phase D 완성. D-1(ESG 프록시 점수 API). D-2(IR보고서 RAG). D-3(분봉 수집 FDR+fallback). D-4(분봉 지표 RSI/MACD/VWAP). D-5(ESG 위젯 대시보드). D-6(ESG 스크리너 필터). 서브페이지 5종 실API 연결(전략·에이전트·백테스팅·리스크·포트폴리오). BFF portfolio/rag 라우트 추가. |
| v2.5 | 2026-06-18 | F7 시뮬레이션 매수/매도 추가. F6.2.9 TopBar 종목코드+기업명 표시(localStorage 영속·SSR hydration 수정). F6.2.10 서브페이지(리스크·백테스팅·에이전트) 종목 컨텍스트 유지. BFF POST /api/paper/execute 라우트 추가. |
| v2.6 | 2026-06-18 | F6.2.11 4분면 캔들 차트(CandleChart4: 5분봉·시간대별·요일별·일봉). F7.3 SIMULATION 예수금 추적(초기 1천만원, 매수차감/매도가산). 포트폴리오 BFF 보강(현재가·종목명·손익·비중). 서브페이지 자동조회(백테스팅·에이전트 마운트 시). Makefile local-dev/local-staging 단축키 추가. |
| v2.7 | 2026-06-18 | F6.2.11 보완: Q1 장마감 후 최근 거래일 표시·마우스 휠 줌·툴팁. Q2/Q3 Y축 줌. X/Y축 레이블 전사분면. 팝업 확대(⛶ Modal). 인트라데이 fallback 선형보간 수정(시간대별 수익률 0 오류 해소). QUAD_H 330→총 660px. |
| v2.8 | 2026-06-18 | F8 사용자 인증 추가: 회원가입/로그인(bcryptjs+jose JWT+TOTP), 예수금 기본 1억원, Sidebar 롤업 마이페이지(비밀번호·예수금·TOTP), AuthGuard(로그인 없이 접근 차단). 백테스팅 qlearn 전략 500 오류 수정(rl_backtest_ticker 자동 위임). Rust INITIAL_CASH 1천만→1억원. |
| v2.9 | 2026-06-18 | F8.7 DB 엔진 `better-sqlite3`→`node:sqlite`(Node 24 내장, ABI 충돌 해소). F8.8 HMR 싱글톤(`globalThis.__authDb`). `make db-reset` 추가. 포트폴리오 매수총금액·매도총금액 컬럼·범례 추가. 포트폴리오 보유종목별 일봉 미니 캔들차트 카루셀(SVG, 좌우 화살표). 전략·리스크·백테스팅·에이전트 페이지 모듈-레벨 상태 영속(종목코드 변경 시만 재조회). 에이전트 페르소나 `scalp`/`safe` 추가(UI 표준명 정렬, 하위호환 유지). |
| v2.10 | 2026-06-18 | F6.2.12 TopBar 사용자별 종목조회 히스토리(localStorage `st_ticker_history_{userId}`, 최대 10건, 단건/전체 삭제). F7.4 SimulationPanel 수량입력 UX 개선(type=text select-all, qty=0 alert, 예수금 부족 사전 검증 alert). F7.5 SimulationPanel 레이아웃 인라인화(수량+금액+버튼 1행, 버튼 50% 소형화, 패널 높이 정렬). F8.9 예수금 동기화: `POST /paper/set-cash`(Rust) + BFF 프록시 + `change-cash` API → risk-engine cash sync. MyPage 예수금 변경 시 매수총금액 floor 자동 적용. F9.1 전략·스크리너 컬럼 정렬(종목코드·종목명·현재가·거래량·RSI·시그널·ESG·공매도%, 초기 종목명 내림차순). F9.2 포트폴리오 보유 포지션 컬럼 정렬(10개 컬럼 전체, 초기 종목명 오름차순). |
| v2.11 | 2026-06-18 | F8.10 로그인 아이디 기억하기·자동로그인: `storeSession(autologin)` localStorage/sessionStorage 분기, `getToken()`·`getStoredUser()` 듀얼-스토어 fallback. 로그인 화면 체크박스 2개(아이디 기억하기·자동로그인). `ClientLayout` `getToken()` 사용. |
| v2.12 | 2026-06-18 | F7.6 예수금 sync 버그 수정: `change-cash/route.ts` fire-and-forget → `await`(try/catch) 변경으로 race condition 해소. 포지션 소멸은 risk-engine 인메모리 특성(재시작 시 초기화) 안내. |
| v2.13 | 2026-06-18 | F7.7 매수총금액 = 매수시단가×수량: Rust `Position.cost_basis: f64` 추가(매수 시 `+= fill_price×qty`, 매도 시 비례 차감). 포트폴리오 `buy_amount` 컬럼 `cost_basis` 우선 사용, 범례 "매수시단가×수량" 변경. |
| v2.14 | 2026-06-18 | F6.2.13 URL 파라미터 숨김: ticker·persona를 URL 쿼리스트링 대신 쿠키(`st_ticker`/`st_persona`, 30일)로 전달. TopBar `navigate()` → cookie 설정 후 `router.push('/')`. `app/page.tsx` → `next/headers cookies()` 읽기(searchParams 제거). 주소창 항상 `/` 표시. |
| v2.31 | 2026-06-19 | F10.1 사이드바 서비스 상태 실시간 헬스체크: BFF `GET /api/services/health` 신규 엔드포인트(ingest·analysis·agents·risk 병렬 2s timeout). Sidebar `StatusDot` 30초 폴링, 절대 색상(UP=#3fb950 초록, DOWN=#f85149 적색, 확인중=#6e7681 회색) — 한국 주식 색상 관례(`var(--color-up)` 적색) 간섭 방지. 툴팁에 정상/연결불가 상태 표시. TS clean. |
| v2.30 | 2026-06-19 | F5 백테스팅 화면 통합: 규칙기반(SMA교차·RSI임계·MACD·Q-러닝) + 강화학습(DQN/PPO/A2C/QR-DQN) 2탭을 `/backtest` 단일 페이지로 통합. 종목코드 공유 입력창, 규칙기반 마운트 시 자동실행, 거래내역 펼침, 강화학습 수 분 소요 안내. 전략/스크리너 페이지 백테스트 탭 제거 → "↺ 백테스팅 →" 배너로 대체. API 응답 필드 매핑 수정(`total_return_pct/100→total_return`, `num_trades→total_trades`). TS clean. |
| v2.29 | 2026-06-19 | F9.4 전략/스크리너 화면 전면 개선 + 행 클릭 버그 수정: ① 스크리너 탭 — RSI범위(min/max)·최소거래량·종가범위(하한/상한) 필터 추가 노출(백엔드 기존 지원). ② 전략 백테스트 탭(신규) — 규칙기반(SMA교차·RSI임계·MACD·Q-러닝)·강화학습(DQN/PPO/A2C/QR-DQN) 전략 선택·실행·결과 지표(총수익률·샤프·낙폭·승률·거래횟수) 표시. ③ BFF `POST /api/backtest/rl` 신규 라우트(algo=DQN→`/backtest/dqn`, PPO→`/backtest/dpg?mode=ppo`, A2C→`/backtest/dpg?mode=a2c`, QRDQN→`/backtest/qrdqn`). ④ `navigateToTicker` 쿠키+localStorage(st_ticker/st_name) 동기 설정 → TopBar 즉시 반영 버그 수정. `window.location.assign('/')` 하드 네비게이션. TS clean. |
| v2.28 | 2026-06-18 | F9.3 포트폴리오·전략/스크리너 행 클릭 → 대시보드 이동: 보유종목·스캔결과 행 클릭 시 `st_ticker` 쿠키 설정 후 `/` 이동, 대시보드 매수/매도 즉시 접근. cursor: pointer + tooltip 추가. TS clean. |
| v2.27 | 2026-06-18 | F8.11 버그수정 — 재시작 영속화 강화: `tokio::spawn` 비동기 저장→동기 호출 변경(SIGINT 전 완료 보장). SIGINT/SIGTERM graceful shutdown 훅 추가(종료 전 최종 스냅샷 저장). 원자적 파일 쓰기(`.tmp`→rename으로 손상 방지). Rust 81/81 PASS. |
| v2.26 | 2026-06-18 | F8.12 포트폴리오 예수금 표시 정합성: 마이페이지 예수금 입력을 `user.initial_cash`(설정값)→`portfolio.cash`(risk-engine 실제 잔여)로 초기화. 라벨 "잔여예수금"·"총 자산(예수금+평가)" 명확화. 총 자산 = 잔여예수금 + 포지션시가합계. |
| v2.25 | 2026-06-18 | F8.11 페이퍼 트레이딩 재시작 영속화: `data/paper_book.json` JSON 스냅샷 — DATABASE_URL 없는 로컬 환경에서 체결/예수금 변경 시 스냅샷 저장, 재시작 시 복원. `PaperBookSnapshot` 직렬화(`Position`+`Fill` Deserialize 추가). |
| v2.24 | 2026-06-18 | F7.10 매수 수수료 취득원가 포함: `cost_basis += fill_price×qty + fee`, `avg_price = (prev + fill+fee) / qty`. 즉시 매수→매도 시 수수료(매수 0.015%+매도 0.015%) 손익 반영. 슬리피지=0 유지, 수수료만 현실 반영. |
| v2.23 | 2026-06-18 | F6.3 색상 한국 주식시장 관례 변경: 상승(+)=적색, 하락(−)=파란색. `globals.css` `--color-up: #f85149`(적), `--color-down: #388bfd`(청). 라이트 모드 `#cf222e`/`#0969da`. 포트폴리오 범례 "적색(+) 이익 · 파란색(−) 손해" 수정. MiniCandleChart 하드코딩 색상 동일 적용. |
| v2.22 | 2026-06-18 | F7.9 포트폴리오 개선: ① 컬럼 "평균단가"→"매수시단가"(cost_basis/qty = avg_price, 검증 명확화). ② 테이블 합계 행 추가(매수총금액 합계·매도총금액 합계·평가손익 합계·수익률·비중 100%). ③ 페이퍼 트레이딩 슬리피지 0 제거(`SLIPPAGE_BPS=0.0`) — 화면 가격 그대로 체결, 즉시 평가손익 0. |
| v2.21 | 2026-06-18 | F7.8 SimulationPanel 종목 변경 시 초기화: `useEffect([ticker])`로 수량→1, 체결결과→null, 오류→'' 자동 리셋. |
| v2.20 | 2026-06-18 | F7.5 최종: SimulationPanel 2행(행1: 현재주가·수량·= 금액, 행2: 예수금(소형)+매수/매도 버튼 우측). 매수총금액 > 예수금 시 적색+볼드 표시. |
| v2.19 | 2026-06-18 | F7.5 레이아웃 최종: SimulationPanel 단일 행 `(현재주가) X원 · 수량 [input] · = Y원 · [▲매수] [▼매도]`. 예수금 소형(9px) 하단 독립 표시. |
| v2.18 | 2026-06-18 | F7.5 확정 레이아웃: SimulationPanel 좌우 2열(좌: 현재주가·수량·= 금액 3행, 우: ▲매수/▼매도 버튼 세로). 예수금 3행 아래. 라벨 '매수/매도가격' 제거. |
| v2.17 | 2026-06-18 | F7.4 수량입력 `type="number"` 복원: 브라우저 기본 스피너(위아래 화살표) 사용. ESG·공매도 필터와 동일한 입력 UX. |
| v2.16 | 2026-06-18 | F7.4 재설계: SimulationPanel 3항목 수직 배치(현재주가·수량·매수/매도가격). 수량 스텝 버튼 `▼`/`▲` 화살표. 매수/매도 버튼 독립 하단 행. |
| v2.15 | 2026-06-18 | F6.2.13 확장: Sidebar 서브페이지 메뉴 링크 쿼리스트링 완전 제거(`<Link href={item.href}>`). 페르소나 선택기 `<Link>` → `<button onClick>` 전환(cookie 설정 + `router.push('/')`). `useSearchParams` 제거, useEffect cookie 읽기. 포트폴리오·전략·리스크·백테스팅·에이전트 전 서브페이지 파라미터 숨김. |
