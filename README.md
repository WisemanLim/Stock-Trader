[English](README.en.md) | **한국어**

# Stock Trader AI Platform

> 금융 도메인(KSIC K) 실시간 주식 트레이딩 AI 플랫폼.
> 규제 준수: 전자금융감독규정·ISMS-P·PCI-DSS 4.0.1 → [COMPLIANCE.md](COMPLIANCE.md)

## 개요

profile: `python-fastapi` (+ `rust-axum` 코어, `node-next-nest` 웹) · domain: `finance`

| 문서             | 링크                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| PRD v2           | [.docs/Stock-Trader-PRD.v2.md](.docs/Stock-Trader-PRD.v2.md)         |
| KRX 사이트 분석  | [.docs/krx-refer/Analysis-site.md](.docs/krx-refer/Analysis-site.md) |
| 규제 가이드      | [COMPLIANCE.md](COMPLIANCE.md)                                       |
| 환경 변수 템플릿 | [.env.example](.env.example)                                         |
| 시험 결과        | [test/impl/27/result.md](test/impl/27/result.md)                     |

![Stock Trader AI Platform Demo](.docs/Stock-Trader.gif)

## 구현 현황 (PRD 매핑)

| 기능                     | 서비스               | 상태 | 비고                                                                                                                                                                                                                                   |
| ------------------------ | -------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1.1 시세·OHLCV·종목     | ingest               | ✅   | FinanceDataReader                                                                                                                                                                                                                      |
| F1.6 멀티소스 폴백       | ingest               | ✅   | **FDR → Naver Finance → Daum Finance** 자동 폴백 — KRX 시스템 점검·봇차단 시 대안 소스 자동 전환. `GET /krx/data-sources` 소스 헬스체크                                                                                              |
| F1.2 호가창              | ingest               | ✅   | 가격기반 시뮬레이션                                                                                                                                                                                                                    |
| F1.2 브로커 WS 피드      | ingest               | ✅   | 실 WS 연동 / random-walk 시뮬 폴백                                                                                                                                                                                                     |
| F1.2 적응형 흐름제어     | ingest               | ✅   | **AIMD 처리율 + 우선순위 큐 + 백프레셔** — `SubscriptionManager` 토큰버킷에 통합(옵트인)                                                                                                                                               |
| F1.5 KRX OPEN API 수집기 | ingest               | ✅   | OTP→데이터 2단계, OHLCV+투자자수급, API키 미설정 시 폴백                                                                                                                                                                               |
| F1.3 뉴스 RSS            | ingest               | ✅   | feedparser                                                                                                                                                                                                                             |
| F1.4 FastMCP             | ingest               | ✅   | Claude/Gemini 연동                                                                                                                                                                                                                     |
| F2.1 기술지표            | analysis             | ✅   | RSI·MACD·Bollinger·EMA·SMA·ATR                                                                                                                                                                                                         |
| F2.2 예측                | analysis             | ✅   | 멀티변량(거시 합성 17종 + **erc_quest_adaptive(적응격자 QuEST)·erc_factor(MP 팩터/노이즈 분리)** + MP 적합도검정 + FinBERT/KR-FinBERT)                                                                                                 |
| F2.3 스크리너            | analysis             | ✅   | RSI·거래량 필터 + **펀더멘털 필터(PER·PBR·ROE·부채비율·배당수익률)** + **KRX 점검 시 KOSPI/KOSDAQ 자동 폴백**                                                                                                                         |
| F2.4 펀더멘털 기업평가   | analysis             | ✅   | **Naver Finance API** — PER·PBR·EPS 실시간 조회. `GET /fundamental/{ticker}`. 16개 주식용어(KOSPI·KOSDAQ·PER·PBR·ROE·EPS·매출액·영업이익·당기순이익·부채비율·배당수익률·이동평균선·거래량·RSI·HTS·MTS) PRD 정의                      |
| F3.1 멀티에이전트        | agents               | ✅   | Scraper·Analyst·Portfolio·Decision                                                                                                                                                                                                     |
| F3.3 자가교정 루프       | agents               | ✅   | **전략 드리프트 감시(churn·저신뢰·비중위반) + HOLD 강등·비중 클램프**                                                                                                                                                                  |
| F3.2 Quant RAG           | rag                  | ✅   | 하이브리드 검색·환각차단 + pgvector 영속화                                                                                                                                                                                             |
| F4 리스크 엔진           | risk-engine          | ✅   | Stop-Loss·Trailing·일일한도·Fail-Safe + **펀더멘털 규칙 7종(PER·PBR·부채비율 초과→BlockBuy / ROE·RSI·이동평균 데드크로스·거래량 급감→ReducePosition)** · 94 tests · **Postgres fills 영속화(DATABASE_URL_SYNC) + risk-engine-data 볼륨 + `paper_settings` 초기예수금 영속화(iter-70)** |
| F5 백테스팅              | analysis             | ✅   | 다전략 + RL(…·DPG **reinforce/a2c/ppo·GAE**) + **영속 워커풀·공유메모리(persistent)**                                                                                                                                                  |
| F5 가상체결              | risk-engine          | ✅   | 다종목·롤링·5요인·full VAR(p)·YW + companion 복소 고유값 QR(Schur) 반경 사영 + **계정 다중화(account별 격리 원장)**                                                                                                                    |
| F6.1 스캘퍼 TUI          | apps/tui             | ✅   | ratatui 호가창·P&L                                                                                                                                                                                                                     |
| F6.2 웹 대시보드         | web                  | ✅   | Next.js + NestJS BFF + **4분면 캔들 차트(5분봉·시간대별·요일별·일봉, iter-36)** + **다크/라이트 테마 토글·툴팁** + **TopBar 종목코드+기업명 표시·localStorage 영속(iter-35)** + 서브페이지 자동조회(리스크·백테스팅·에이전트, iter-36) · **TopBar 한글 회사명 ticker 오염 버그 수정 + page.tsx cookie 무효값 폴백(iter-67)** |
| F7 시뮬레이션 매수/매도  | web/risk             | ✅   | 대시보드 매수▲/매도▼ 패널(SimulationPanel) → BFF POST /api/paper/execute → risk-engine 가상체결 원장 · **예수금 추적(초기 1억원, 매수차감/매도가산, iter-38)** → 포트폴리오 현재가·종목명·손익·비중 BFF 보강(iter-36)                  |
| F8 사용자 인증           | web                  | ✅   | 회원가입/로그인(bcryptjs+jose JWT+TOTP otplib), 예수금 기본 1억원, **Sidebar 롤업 마이페이지**(비밀번호·예수금·TOTP), AuthGuard 라우트 보호, SQLite(`node:sqlite` Node 24 내장, `globalThis` HMR 싱글톤) · **회원가입 예수금 입력 `type=number` 수정**(iter-63) · **예수금 `min=1000000` 수정 — 100만원 단위 step 유효값 오류 해소**(iter-64) · **자동로그인 AES-256-GCM 암호화 자격증명 저장(iter-69)** · **예수금 재기동 후 초기화 버그 수정(페이지 로드 시 60초 주기 재동기화)** — `iter-38~39` |
| F6.3 알림                | agents               | ✅   | Telegram/Discord webhook                                                                                                                                                                                                               |
| F6.3 양방향 제어         | agents + risk-engine | ✅   | **봇 중지(halt)/긴급청산 원격 제어 + 인바운드 명령(시크릿 인증)**                                                                                                                                                                      |

## 아키텍처 / 서비스 역할

```
Stock-Trader/
├── services/
│   ├── ingest/     F1 시세·호가창·뉴스·FastMCP·AIMD흐름제어  :8003  Python/FastAPI
│   ├── analysis/   F2 기술지표·예측·스크리너·RL(영속풀)        :8001  Python/FastAPI
│   ├── rag/        F3.2 Quant RAG                          :8002  Python/FastAPI
│   └── agents/     F3.1 멀티에이전트·F3.3 자가교정·F6.3 제어   :8004  Python/FastAPI
├── core/risk-engine/  F4 Stop-Loss/Trailing·F6.3 halt/청산  :3001  Rust/Axum
├── Procfile.dev       MPM 정적 오케스트레이션(make dev-all)
├── tools/mpm/         MPM Procfile 생성기(레지스트리·ENV·그룹, make mpm)
├── apps/tui/          F6.1 스캘퍼 콘솔                  Rust/ratatui
└── web/
    ├── apps/dashboard  F6.2 대시보드              :3000  Next.js 15
    └── apps/bff        BFF 집계 게이트웨이         :3002  NestJS 11
```

인프라: PostgreSQL 17 (pgvector 0.8.2) + Redis 7.4

## 사전 요구사항

| 도구           | 버전(검증)           | 확인                |
| -------------- | -------------------- | ------------------- |
| Python         | 3.12+ (venv 3.13.12) | `python3 --version` |
| uv             | 0.4+                 | `uv --version`      |
| Node.js        | 20 LTS+ (v26)        | `node --version`    |
| pnpm           | 9+ (10.33)           | `pnpm --version`    |
| Rust/cargo     | 1.80+ (1.95)         | `cargo --version`   |
| Docker Desktop | 최신                 | `docker info`       |

> **cargo PATH**: `export PATH=$HOME/.cargo/bin:$PATH` — `~/.zshrc` 에 추가

## 환경 설정

```bash
cp .env.example .env.local   # 루트 + 각 서비스 디렉터리
```

| 파일           | 용도                                        |
| -------------- | ------------------------------------------- |
| `.env.local`   | 로컬 직접 실행 (SQLite, Redis 선택)         |
| `.env.dev`     | docker compose 개발 (Postgres + Redis)      |
| `.env.staging` | prod 동등 구성 검증                         |
| `.env.prod`    | 키 목록만 — Vault/K8s External Secrets 주입 |

> **⚠️ 실 증권사 API Key·Secret → OS Keychain 또는 Vault. 파일 기재 절대 금지.**
> 비-프로덕션 데이터는 합성 데이터만 사용 (COMPLIANCE.md).

### AUTH_JWT_SECRET 설정 방법

대시보드(F8 사용자 인증)는 JWT 서명에 `AUTH_JWT_SECRET`(32바이트 이상 랜덤값)을 필요로 한다.

**발급:**
```bash
openssl rand -base64 32
```

| 환경 | 방법 | 비고 |
|------|------|------|
| `local` | `.env.local` 에 직접 기재 | 개발용 임시값 허용 |
| `dev` | `.env.dev` 에 직접 기재 | 개발용 임시값 허용 |
| `staging` | 쉘 `export` 후 make 실행 | 파일 기재 금지 |
| `prod` | 쉘 `export` 후 make 실행 (K8s: Vault 자동 주입) | 파일 기재 절대 금지 |

> **Docker Compose env_file 주의:** `.env.staging` / `.env.prod` 의 `${AUTH_JWT_SECRET}` 는 쉘 변수로 **확장되지 않는다**. compose 실행 전 반드시 쉘에서 `export` 로 설정해야 한다.

```bash
# staging / prod — Docker Compose 실행 전 쉘에서 설정
export AUTH_JWT_SECRET=$(openssl rand -base64 32)
make up ENV=staging   # 또는 ENV=prod

# macOS Keychain 활용 (장기 보관)
security add-generic-password -a stock-trader -s AUTH_JWT_SECRET \
  -w "$(openssl rand -base64 32)"
export AUTH_JWT_SECRET=$(security find-generic-password \
  -a stock-trader -s AUTH_JWT_SECRET -w)
make up ENV=prod
```

각 서비스는 자체 CWD 의 `.env.local` 을 pydantic-settings 로 로드:

```
services/ingest/.env.local, services/analysis/.env.local, ...
```

## 실행 방법

### A) docker compose (멀티서비스)

```bash
make up                  # 인프라만 (postgres+pgvector, redis). 기본 ENV=local
make up ENV=dev          # ENV 전달 → compose env_file=.env.dev 선택
make up-app              # 전체 앱 스택(app 프로파일)까지 컨테이너 기동
make build               # docker compose --profile app build
make sync                # 전 서비스 의존성 동기화 (uv sync + pnpm install)
make dev-ingest          # 개별 서비스 (uvicorn --reload, 볼륨마운트)
make dev-analysis / dev-rag / dev-agents / dev-risk / dev-tui / dev-web
make local-all           # ENV=local 전 서비스 백그라운드 기동 (권장, 기존 프로세스 자동 중지 후 재시작)
make local-dev           # ENV=dev 고정 단축키
make local-staging       # ENV=staging 고정 단축키
make local-stop          # 전 서비스 중지
make local-logs          # 통합 로그 tail
make local-status        # 프로세스 상태
make dev-all             # 포그라운드 기동 (터미널 점유, Ctrl-C 전체 종료)
make down                # 전체 중단

# ── 프로덕션 Docker Compose (ENV=prod) ────────────────────
export AUTH_JWT_SECRET=$(openssl rand -base64 32)
make prod-all            # 인프라 + 전체 앱 컨테이너 기동
make prod-stop           # 전 컨테이너 중지
make prod-logs           # 통합 로그 tail
make prod-status         # 컨테이너 상태
make prod-build          # 이미지 빌드
```

### MPM(멀티프로세스 매니저) — `make local-all` (권장)

6 프로세스(ingest·analysis·rag·agents·risk·web)를 **터미널 1개**로 일괄 기동·관리. `uvx` 로 honcho 임시 실행 → **별도 설치 불필요**.

> ⚠️ `make local-all`(백그라운드)과 `make dev-all`(포그라운드)을 **동시에 실행하면 포트 충돌**로 서비스가 강제 종료됩니다. 둘 중 하나만 사용하세요.

```bash
# ── 권장: 백그라운드 일괄 기동 ─────────────────────────────
make local-all                    # ENV=local 전 서비스 백그라운드 기동 (기존 프로세스 자동 중지)
make local-dev                    # ENV=dev 고정 단축키
make local-staging                # ENV=staging 고정 단축키
make local-stop                   # 전 서비스 중지
make local-logs                   # 통합 로그 tail (.mpm/mpm.log)
make local-status                 # 프로세스 상태(pid)

# ── 포그라운드 (터미널 점유, 색상 로그) ───────────────────────
make dev-all                      # Ctrl-C 로 전체 종료

# ── 저수준 MPM 명령 ────────────────────────────────────────
make mpm ENV=dev GROUP="py rust"  # dev 환경, python+rust 그룹만
make mpm-check ENV=dev GROUP=py   # 생성물 검증(exit code)
```

> **tools/mpm**: 서비스 레지스트리(`SERVICES`) 단일 소스에서 ENV·그룹별 honcho Procfile 을 결정적 생성하고, 전 프로세스를 **백그라운드(detached)** 로 일괄 기동·중지·상태조회한다. `make mpm` = `mpm.py up`(Popen `start_new_session` + `.mpm/{Procfile.gen,mpm.pid,mpm.log}`), `make mpm-stop` = honcho SIGTERM(graceful cascade) + 세션 프로세스그룹 sweep(detach 된 `next dev` 워커까지 정리). 그룹 `py`(ingest·analysis·rag·agents)·`rust`(risk)·`web`. ENV 치환(`APP_ENV`·`.env.{env}`). 표준 라이브러리만(의존 0). 상태 `.mpm/`(gitignore).

> **ENV 전달**: 모든 compose 타겟(`up`/`up-app`/`build`/`down`)이 `ENV=$(ENV)` 를 docker compose 로 넘겨 `.env.$(ENV)` 를 선택. Rust 타겟(`dev-risk`/`dev-tui`)은 `.env.$(ENV)` 를 환경변수로 로드 후 실행.

compose 프로파일:

- 기본(`default`): postgres, redis (`make up`)
- `app`: 모든 서비스 컨테이너 (`make up-app`)

### B) 호스트 직접 실행

```bash
# Python 서비스 (각 디렉터리)
cd services/ingest && uv sync --dev && uv run uvicorn app.main:app --reload --port 8003
cd services/analysis && uv run uvicorn app.main:app --reload --port 8001
cd services/rag && uv run uvicorn app.main:app --reload --port 8002
cd services/agents && uv run uvicorn app.main:app --reload --port 8004

# Rust
export PATH=$HOME/.cargo/bin:$PATH
cargo run -p risk-engine        # :3001
cargo run -p tui                # 스캘퍼 콘솔 (터미널)

# FastMCP 서버 (F1.4)
cd services/ingest && uv run mcp run app/services/mcp_server.py

# Web (pnpm workspace)
cd web && pnpm install
pnpm --filter @stock-trader/bff dev         # :3002
pnpm --filter @stock-trader/dashboard dev   # :3000
```

## 접속·포트 표

| 서비스      | URL                   | 포트 | 프로파일 | API 문서                            |
| ----------- | --------------------- | ---- | -------- | ----------------------------------- |
| ingest      | http://localhost:8003 | 8003 | app      | [/docs](http://localhost:8003/docs) |
| analysis    | http://localhost:8001 | 8001 | app      | [/docs](http://localhost:8001/docs) |
| rag         | http://localhost:8002 | 8002 | app      | [/docs](http://localhost:8002/docs) |
| agents      | http://localhost:8004 | 8004 | app      | [/docs](http://localhost:8004/docs) |
| risk-engine | http://localhost:3001 | 3001 | app      | —                                   |
| bff         | http://localhost:3002 | 3002 | —        | /api/health                         |
| dashboard   | http://localhost:3000 | 3000 | —        | —                                   |
| postgres    | localhost:5432        | 5432 | default  | —                                   |
| redis       | localhost:6379        | 6379 | default  | —                                   |

## 대시보드 페르소나(Persona)

대시보드(`?persona=`) 및 에이전트 분석(`agents/analyze`) 에서 트레이딩 스타일을 선택한다. 페르소나는 리스크 파라미터·포지션 비중 한도·에이전트 결정 임계값에 직접 영향을 준다.

| 페르소나          | URL 값     | 보유 기간       | 특징                                                                             |
| ----------------- | ---------- | --------------- | -------------------------------------------------------------------------------- |
| 스캘퍼 (Scalper)  | `scalper`  | 수 초 ~ 수 분   | 극초단타. 매우 좁은 손절폭, 빠른 진출입, 높은 회전율. 비중 한도 최소(기본 5%).   |
| 데이 (Day Trader) | `day`      | 장중(당일 청산) | 오버나이트 없음. 중간 손절폭, 당일 손익 한도 우선 적용. 비중 한도 중간(기본 8%). |
| 스윙 (Swing)      | `swing`    | 수일 ~ 수주     | 기술적 추세 추종. 표준 손절·트레일링 스탑. 비중 한도 표준(기본 10%). **기본값.** |
| 포지션 (Position) | `position` | 수주 ~ 수개월   | 장기 보유. 넓은 손절폭, 거시 지표·펀더멘털 비중 확대. 비중 한도 최대(기본 15%).  |

> 대시보드 URL 예: `http://localhost:3000/?ticker=005930&persona=scalper`
> 에이전트 API: `POST /agents/analyze` 본문에 `"persona": "day"` 전달.
> 자가교정(`/agents/self_correct`)도 페르소나별 비중 한도 기준으로 드리프트 판정.

## 구현된 API 예시

### F1 ingest

```bash
curl http://localhost:8003/market/price/005930
# {"ticker":"005930","price":73500.0,"change":0.021,"volume":1200000,...}

curl "http://localhost:8003/market/ohlcv/005930?days=30"
curl http://localhost:8003/market/tickers/KRX

curl "http://localhost:8003/orderbook/005930?levels=10"
# {"ticker":"005930","ask_levels":[...],"bid_levels":[...],"spread":50.0,"mid_price":73525.0}

curl http://localhost:8003/news/sources
curl http://localhost:8003/news/reuters-business?limit=10
```

### F2 analysis + F5 백테스팅

```bash
curl "http://localhost:8001/indicators/005930?days=60"
# {"ticker":"005930","rsi":42.5,"macd":{...},"bollinger":{...},"atr":820.0,"signal":"HOLD"}

curl http://localhost:8001/predict/005930                       # 선형회귀(빠름)
curl "http://localhost:8001/predict/005930?model=lstm"          # LSTM
curl "http://localhost:8001/predict/005930?model=transformer"   # Transformer
# {"model":"transformer-v1","weights_source":"checkpoint","horizons":[...]}
curl -X POST "http://localhost:8001/predict/005930/train?arch=transformer"  # 사전학습 → 체크포인트
curl -X POST http://localhost:8001/predict/retrain -H 'content-type: application/json' \
  -d '{"tickers":["005930","000660"],"arch":"lstm","max_age_hours":24}'      # 스케줄 재학습(stale만)

curl -X POST http://localhost:8001/screener/ \
  -H 'content-type: application/json' \
  -d '{"market":"KRX","rsi_max":30,"limit":10}'

# F5 다전략 백테스팅 (sma_cross | rsi_threshold | macd_cross | qlearn)
curl http://localhost:8001/backtest/strategies
curl -X POST http://localhost:8001/backtest/ -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"strategy":"rsi_threshold","params":{"rsi_buy_below":30,"rsi_sell_above":70}}'

# F5 강화학습 백테스팅 — Q-learning(테이블) / DQN(신경망)
curl -X POST http://localhost:8001/backtest/rl  -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":50}'   # 테이블 Q-learning
curl -X POST http://localhost:8001/backtest/dqn -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":30}'   # Rainbow급 DQN (Double·Dueling·PER·n-step·Noisy)
curl -X POST http://localhost:8001/backtest/c51 -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # Distributional C51
curl -X POST "http://localhost:8001/backtest/qrdqn?mode=fqf&cvar_alpha=0.25&fqf_state_dependent=true" \
  -H 'content-type: application/json' -d '{"ticker":"005930","days":365,"episodes":15}'  # QR/IQN/FQF + CVaR
curl -X POST "http://localhost:8001/backtest/dpg?mode=ppo&n_rollouts=4&parallel=true&executor=process" -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # DPG(PPO·minibatch·KL) + 멀티프로세스(state_dict 복제) 병렬 롤아웃
# {"strategy":"dpg","mode":"ppo","n_rollouts":4,"parallel":true,"executor":"process","sharpe":..,"num_trades":..}
curl -X POST "http://localhost:8001/backtest/dpg?mode=a2c&n_rollouts=4&parallel=true&executor=persistent" -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # 영속 워커풀(재사용) + 공유메모리(SharedMemory) 텐서
# {"executor":"persistent",...}  — px/rsi 1회 적재·풀 재사용. process·순차와 동일 결과(결정적)
# 영속 풀(MPM): 워커수 BACKTEST_PERSIST_WORKERS env, BrokenProcessPool 자동 재생성, persistent_pool_stats() 조회
```

> RL 병렬 롤아웃 `executor`: `thread`(공유모델) · `process`(에피소드마다 풀 생성, state_dict 복제) · `persistent`(영속 풀 재사용 + `SharedMemory` 로 px/rsi 무복사 매핑 — 풀 재생성 비용 제거). 세 모드 모두 롤아웃별 시드로 순차와 동일 결과.

> 멀티변량 거시 채널: `MACRO_INDICES` 다지표 + `MACRO_COMBINE` 17종(…·erc_lw·erc_cc·erc_oas·erc_nlw·erc_quest·erc_quest_grid·**erc_quest_adaptive**(적응 격자 QuEST, 분위수 노드)·**erc_factor**(MP 상한 λ⁺ 초과=신호 보존·bulk 평탄화 RMT 디노이징)·pca·ipca·ccipca) 합성. 진단: `marchenko_pastur_gof(eigs, c)` = 표본 고유값 vs MP 법칙 KS 거리(신호 검출). 뉴스 센티먼트는 `FINBERT_ENABLED=true` 시 FinBERT(`FINBERT_MODEL`=`ProsusAI/finbert` 또는 KR `snunlp/KR-FinBert-SC`), 아니면 키워드. 소스/모델 장애 시 중립 폴백.

### F3 rag / agents

```bash
curl -X POST http://localhost:8002/rag/ingest -H 'content-type: application/json' \
  -d '{"documents":[{"id":"fed1","content":"Fed held rates at 5.5%","meta":{}}]}'
curl -X POST http://localhost:8002/rag/query -H 'content-type: application/json' \
  -d '{"query":"fed interest rates","k":3}'
# {"answer":"...","sources":[...],"grounded":true}   # 근거 없으면 grounded:false (환각차단)

curl -X POST http://localhost:8004/agents/analyze -H 'content-type: application/json' \
  -d '{"ticker":"005930","persona":"swing"}'
# {"notes":[{"agent":"Scraper",...},...],"decision":{"signal":"BUY","weight":0.27,"confidence":0.8}}

# F3.3 전략 자가교정 — 결정 이력+후보로 드리프트 판정 후 보수적 교정안
curl -X POST http://localhost:8004/agents/self_correct -H 'content-type: application/json' \
  -d '{"persona":"scalper","history":[{"signal":"BUY","confidence":0.8,"weight":0.1}],
       "candidate":{"signal":"BUY","confidence":0.8,"weight":0.5}}'
# {"drift":{"drift":true,"reasons":["weight_breach(...)"],...},
#  "corrected":{"signal":"BUY","weight":0.1,"corrected":true,"corrections":["weight_clamped_to_0.1"]}}
# churn(BUY↔SELL 빈번)·저신뢰 시 → corrected.signal="HOLD"(강등)

# F6.3 알림 (미설정 채널은 false → no-op)
curl -X POST http://localhost:8004/notify/ -H 'content-type: application/json' \
  -d '{"event":"STOP_LOSS","payload":{"ticker":"005930","price":68600}}'
# {"message":"...","telegram":false,"discord":false}

# F6.3 양방향 제어 — 인바운드 명령(시크릿 인증 필수, CONTROL_SECRET 미설정 시 403 전거부)
curl -X POST http://localhost:8004/control/command -H 'content-type: application/json' \
  -d '{"secret":"<control-secret>","text":"/stop"}'        # 봇 긴급 중지(halt)
# {"command":"/stop","result":{"halted":true}}
curl -X POST http://localhost:8004/control/command -H 'content-type: application/json' \
  -d '{"secret":"<control-secret>","text":"/liquidate","prices":{"005930":71000}}'  # 긴급 청산
# {"command":"/liquidate","result":{"liquidated":1,"realized_pnl":..,"halted":true}}
# /resume(재개) · /status(상태). Telegram 웹훅: POST /control/telegram?secret=... (또는 X-Telegram-Bot-Api-Secret-Token 헤더)
```

### F4 risk-engine + 가상체결

```bash
curl -X POST http://localhost:3001/risk/check -H 'content-type: application/json' \
  -d '{"ticker":"005930","entry_price":70000,"current_price":68600,
       "stop_loss_pct":0.02,"daily_loss_limit_pct":0.05,"max_position_pct":0.10}'
# {"ticker":"005930","action":"force_sell","triggered":["stop_loss"],"reason":"Stop-Loss: ..."}

# 가상(시뮬레이션) 체결 — 실거래 아님. 다종목·슬리피지·수수료·append-only 원장
# DATABASE_URL=postgres 면 paper_fills 영속화 + 재시작 하이드레이션
# client_order_id = 멱등키(선택). 동일 키 재전송 시 1회만 체결(원장·DB 중복 방지, COMPLIANCE §4.1)
curl -X POST http://localhost:3001/paper/execute -H 'content-type: application/json' \
  -d '{"ticker":"005930","side":"buy","quantity":10,"price":70000,"client_order_id":"ord-20260607-001"}'
# 재전송(동일 client_order_id) → {"accepted":true,"reason":"중복 주문(멱등키) — 기존 체결 반환",...} (재체결 없음)
curl -X POST http://localhost:3001/paper/execute -H 'content-type: application/json' \
  -d '{"ticker":"000660","side":"buy","quantity":5,"price":120000}'
curl http://localhost:3001/paper/portfolio
# {"positions":[...],"realized_pnl":..,"realized_by_ticker":{"005930":..,"000660":..},"fills":N}

# 계정 다중화 — ?account= 로 격리 원장(미지정=default). DB 영속화는 기본 계정만, 명명 계정은 인메모리.
curl -X POST "http://localhost:3001/paper/execute?account=strat-A" -H 'content-type: application/json' \
  -d '{"ticker":"005930","side":"buy","quantity":10,"price":70000}'
curl "http://localhost:3001/paper/portfolio?account=strat-A"   # {"account":"strat-A","positions":[...],...}
curl http://localhost:3001/paper/accounts                       # {"accounts":["default","strat-A"]}

# mark-to-market — 현재가 입력 → 종목별 미실현 + 손익곡선 점 추가
curl -X POST http://localhost:3001/paper/mark -H 'content-type: application/json' \
  -d '{"005930":75000,"000660":115000}'
# {"realized":..,"unrealized":..,"equity":..,"unrealized_by_ticker":{"005930":..,"000660":..}}
curl http://localhost:3001/paper/equity_curve
# [{"ts":..,"realized":..,"unrealized":..,"equity":..}, ...]   (DATABASE_URL 시 영속·재시작 복원)
curl "http://localhost:3001/paper/equity_agg?period=daily"     # daily|weekly|monthly|quarterly OHLC
# [{"bucket":..,"open":..,"close":..,"high":..,"low":..,"points":N}]
curl -X POST http://localhost:3001/paper/alpha -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[2400,2450,2500]}'  # 벤치마크 대비 알파
# {"portfolio_return":..,"benchmark_return":..,"alpha":..}
curl -X POST http://localhost:3001/paper/risk_metrics -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[2400,2440,2420,2480]}'  # beta·IR·TE
curl -X POST http://localhost:3001/paper/risk_rolling -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[...],"window":20}'      # 롤링 윈도우 지표
curl -X POST http://localhost:3001/paper/factor_regression -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[..mkt..],[..smb..],[..hml..]]}'  # Fama-French OLS
curl -X POST http://localhost:3001/paper/factor_regression_nw -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[..mkt..],[..smb..],[..hml..],[..rmw..],[..cma..]],"lag":4}'
# 5요인 + Newey-West HAC SE: {"alpha":..,"betas":[..×5],"std_errors":[..×6],"lag":4}
curl -X POST http://localhost:3001/paper/factor_regression_nw_auto -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]]}'  # Andrews 자동 대역폭
# {"alpha":..,"betas":[..],"std_errors":[..],"lag_auto":N}
curl -X POST http://localhost:3001/paper/factor_regression_qs -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"prewhiten":true,"full_var":true}'  # QS + full VAR(1)
curl -X POST http://localhost:3001/paper/factor_regression_qs_aic -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"max_order":5}'  # AIC 대각 AR(p)
curl -X POST http://localhost:3001/paper/factor_regression_qs_var -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"max_order":3,"criterion":"bic","stabilize":true,"companion":true}'
# full VAR(p)·BIC/HQ + companion 안정성 사영: {"alpha":..,"std_errors":[..],"var_order":N,"stabilize":true,"companion":true}

# F6.3 긴급 제어 (risk-engine 직접) — agents /control 이 위임하는 엔드포인트
curl -X POST http://localhost:3001/control/halt -H 'content-type: application/json' -d '{"halted":true}'
curl http://localhost:3001/control/status        # {"halted":true,"open_positions":N}
# 계정별 제어: ?account=strat-A (halt·status·liquidate 모두 계정 독립)
# halt=true 면 /paper/execute 신규주문 차단. 청산은 halt 독립(Fail-Safe).
curl -X POST http://localhost:3001/control/liquidate -H 'content-type: application/json' \
  -d '{"prices":{"005930":71000,"000660":121000}}'  # 보유 전종목 시장가 매도 + 자동 halt
# {"liquidated":2,"fills":[...],"realized_pnl":..,"halted":true}  (청산 체결도 append-only 원장 보존)
```

### F1.5 KRX OPEN API

```bash
curl http://localhost:8003/krx/status
# {"configured":false,"note":"KRX_OPEN_API_KEY 환경변수 설정 시 활성화됩니다."}
# API 키 설정 시: KRX_OPEN_API_KEY=<발급키> uv run uvicorn ...

curl "http://localhost:8003/krx/ohlcv/005930?from_date=20260101&to_date=20260131&market=KOSPI"
# {"ticker":"005930","configured":false,"bars":[],"count":0}  (키 미설정)
# 키 설정 시: {"bars":[{"date":"2026-01-01","open":70000,"high":71000,...,"source":"krx_openapi"}],...}

curl "http://localhost:8003/krx/investor-flow/005930"
# {"ticker":"005930","configured":false,"phase":"A_pending","flows":[],"count":0}
# 키 설정 시: {"flows":[{"date":"..","institution":125000,"foreign":-48000,"individual":-77000}],...}
```

> KRX OPEN API 2단계 호출: OTP(`GenerateOTP.jspx`) → 데이터(`jsonSvr.do`). API 키 미설정 시 빈 결과, FinanceDataReader 폴백 유지. API ID: KOSPI=`stk_bydd_trd` / KOSDAQ=`ksq_bydd_trd` / 투자자=`stk_invsr_trd_by_isu`. 호출 간격 최소 0.5s(`KRX_API_RATE_LIMIT`).

### F1.2 브로커 틱 피드 (WebSocket)

```
ws://localhost:8003/market/feed/005930
# BROKER_WS_URL 설정 시 실연동: BROKER_PROTOCOL=generic|kis, 인증(BROKER_API_KEY/SECRET) +
# 하트비트 핑퐁(BROKER_HEARTBEAT_INTERVAL/TIMEOUT) + 지수 백오프 재연결(BROKER_MAX_RETRIES, -1=무한).
# 미설정 시 시뮬레이션.
ws://localhost:8003/market/feed_multi/005930,000660   # 다종목 멀티플렉싱(단일 WS)
```

> **적응형 흐름제어(통합)**: `SubscriptionManager` 옵트인 — `aimd=AIMDRateController(...)` 시 전역 토큰버킷 rate 가 ack 성공=가산증가/구독실패=승법감소(AIMD)로 자동 조절. `command_capacity`/`command_watermark` 시 송신 대기 명령이 우선순위 큐로 관리(해지 우선, 용량초과 시 최저우선 드롭, `command_backpressured()` 신호). 미지정 시 기존 FIFO·고정 rate(하위호환). 순수 흐름제어 단위는 [adaptive_flow.py](services/ingest/app/services/adaptive_flow.py).

### F6.2 BFF 집계 + 실시간 캔들

```bash
curl "http://localhost:3002/api/dashboard/005930?persona=swing"
# {"ticker":"005930","price":{...},"indicators":{...},"decision":{...}}

curl "http://localhost:3002/api/candles/005930?days=30"   # 캔들(OHLCV) — ingest 프록시(days 1~365 클램프)
# {"ticker":"005930","bars":[{"date":..,"open":..,"high":..,"low":..,"close":..,"volume":..}],"count":30}
```

> 대시보드 캔들 차트(`components/CandleChart.tsx`)는 `/api/candles` 로 초기 봉을 받고 `/api/price` 를 5초 폴링해 형성 중 캔들의 close/high/low 를 실시간 갱신(SVG 직접 렌더, 차트 라이브러리 무의존). 기하 변환은 [lib/candles.ts](web/apps/dashboard/lib/candles.ts) 순수 함수로 분리(테스트 대상).

## 테스트

```bash
# 전체
make test-py      # pytest (4개 Python 서비스)
make test-rust    # cargo test (risk-engine + tui)
make test-web     # vitest (bff + dashboard)

# 개별
cd services/ingest && uv run pytest tests/ -v
export PATH=$HOME/.cargo/bin:$PATH && cargo test -p risk-engine
cd web && pnpm -r test
```

**현재 시험 통과: 529 (Python 350 + Rust 90 + Web 78 + tools/mpm 17, pgvector 통합 4 + FinBERT 실모델 1 포함) + postgres 통합 1(ignored, DB 필요)** — [test/impl/34/result.md](test/impl/34/result.md)

> 차수25: bff `@types/node` 추가(`process` TS2580 수정 → BFF 기동·대시보드 연결 복구) + MPM 백그라운드 관리자(`make mpm`/`mpm-stop`/`mpm-status`/`mpm-logs`, tools/mpm +5). E2E 7서비스 기동·정상종료 확인.
> 차수24: MPM 고도화 — tools/mpm Procfile 생성기(ENV·그룹, +12) + RL 영속 풀 stats·env워커·복원력(analysis +3).
> 차수23: F5 가상체결 계정 다중화 — account별 격리 원장(risk-engine +5, 하위호환·기본계정 DB 영속).
> 차수22: F2.2 고도화 — 적응 격자 QuEST·MP 적합도검정·팩터모델 타깃(analysis +9, 가산·무회귀).
> 차수21: F1.2 흐름제어(AIMD·우선순위큐·백프레셔)를 `SubscriptionManager` 토큰버킷에 통합(ingest +8, 옵트인·하위호환).
> 차수20(다음 단계 6종): MPM-RL 영속풀+공유메모리(analysis +3) · F3.3 자가교정(agents +15) · F6.3 양방향 제어(agents +12, risk-engine +6) · F1.2 AIMD·우선순위큐·백프레셔(ingest +14) · F6.2 실시간 캔들(web +15) · MPM-dev honcho `make dev-all`.
> 리뷰 후속 보안 수정(차수19 리뷰):
>
> - **risk-engine**: (1) `/paper/execute` 멱등키(client_order_id) + DB 부분 UNIQUE·ON CONFLICT, (2) `with_book` Mutex poison 복구, (3) BOOK/DB 원자성 — `prepare`(계산만)→DB 영속화→`commit`(원장 반영) 2단계 DB-우선 durability(insert 실패 시 원장 미변경 + 5xx). 시험 52→62 + postgres 통합 1(`make up` 후 `TEST_DATABASE_URL=... cargo test -- --ignored`, 실 postgres 통과).
> - **analysis**: (4) torch 학습 엔드포인트(dqn/c51/qrdqn/dpg·predict·train·retrain) 별도 프로세스 오프로드([app/core/offload.py](services/analysis/app/core/offload.py)) — 이벤트 루프 비블로킹 + torch 격리. `ANALYSIS_INPROC_TRAIN=1`(테스트/로컬) 인프로세스. (5) LSTM 멀티변량 채널 provider 에 실제 ticker 전달(기존 `df.index.name` placeholder 버그 수정).
> - **bff**: (6) 종목코드 검증·인코딩([ticker.util.ts](web/apps/bff/src/ticker.util.ts), `^[A-Za-z0-9]{1,20}$` + encodeURIComponent) — 경로 인젝션 차단. Web 시험 8→11.

> pgvector 통합 시험(4건)은 `make up` 으로 postgres 기동 시 실행, 미연결 시 자동 skip.
> 가상체결 DB 영속화·하이드레이션은 통합 검증(impl/4 result) 참조.

## 트러블슈팅

| 이슈                                           | 원인                                           | 조치                                                             |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `make up` YAML 파싱 오류                       | `env_file: [.env.${ENV:-local}]` 의 `:-`        | 값 인용 `[".env.${ENV:-local}"]` (수정 완료)                     |
| ENV 미지정 시 `.env.dev` 없음 오류             | compose env_file 기본값이 `dev`                 | `env_file: [".env.${ENV:-local}"]` 로 수정 완료                  |
| 회원가입 예수금 15000000 유효하지 않음 오류    | `min="1"` + `step=1000000` 불일치              | `min="1000000"` 으로 수정 완료 — 100만원 배수 전부 유효          |
| `make db-reset ENV=dev` 후 PostgreSQL 데이터 잔존 | `pgdata` 볼륨 삭제가 `echo` 힌트만 출력, 미실행 | `docker volume rm stock-trader_pgdata` 실제 실행으로 수정 완료   |
| 대시보드 캔들/intraday 400·500 오류 (한글·`%EC%...`·`0059307days` 등) | TopBar `handleSubmit` 미검증 입력으로 한글 회사명이 `st_ticker` 쿠키 오염 + `page.tsx` cookie 무검증 전달 | `handleSubmit` 로컬 DB 폴백·무효 시 이동 안 함 + `page.tsx` ticker regex 검증·무효 시 `005930` 폴백 (iter-67) |
| 회원가입 예수금 risk-engine 미반영 (로그인 후에도) | `login/route.ts` cash sync 누락 — 등록 시 risk-engine 미기동이면 register sync 실패, 이후 로그인 시 복구 안 됨 | `login/route.ts` 로그인 성공 시 `POST /api/paper/set-cash` 추가 (iter-68) |
| `make db-reset ENV=prod` 후 회원정보 잔존 | 컨테이너 실행 중 `docker volume rm` → "volume is in use" 실패 (2>/dev/null 로 묻힘) | `docker compose down` 선행 추가 — 볼륨 마운트 해제 후 삭제 (iter-68) |
| `⚠ BFF 연결 실패` 배너 — 서비스 기동 후에도 표시 | `NEXT_PUBLIC_API_BASE` 정의·`NEXT_PUBLIC_BFF_URL` 미정의 불일치 + `getSnapshot` 타임아웃 없음 | `NEXT_PUBLIC_BFF_URL` 으로 통일 + `AbortSignal.timeout(5000)` 추가 (iter-68) |
| 자동로그인 체크 후에도 재시작 시 비밀번호 재입력 | JWT 토큰만 저장 — 만료 후 재인증 불가 | `auth-client.ts` AES-256-GCM 암호화 자격증명 저장(`saveEncryptedCreds`/`loadEncryptedCreds`). `login/page.tsx` 마운트 시 복호화 → 자동 로그인 시도 (iter-69) |
| KRX 시스템 점검·FDR 봇차단 시 시세·OHLCV·분봉 수집 중단 | FDR 단일 소스 의존 — KRX 점검 시 데이터 공백 | `multi_source.py` FDR→Naver Finance→Daum Finance 자동 폴백 오케스트레이터. `GET /krx/data-sources` 소스 헬스체크 (iter-72) |
| 종목 검색 시 hang → BFF 3s 타임아웃 (`지니언스` 등 미포함 종목) | FDR `StockListing` KRX 봇차단 HTML 반환 → `rows=[]` → `_stock_cache_at` 미설정 → 매 요청마다 FDR 재호출 | `krx.py` `_CACHE_FAIL_TTL(5m)` 추가 — 실패 시에도 타임스탬프 설정. `stocks.ts` 지니언스(241840) 추가 (iter-71) |
| ingest 미기동 시 `/api/candles·/api/intraday·/api/price` 모두 500 | BFF `candles()`·`price/:ticker`·`intraday/:ticker` try/catch 없어 `fetchJson` 예외가 NestJS 500으로 전파 | `proxy.service.ts` 3메서드 try/catch 추가 — 빈 결과(`bars:[]`) 또는 `null` 반환. `page.tsx` ticker 검증 강화(`/^([0-9]{6}|[A-Za-z]{1,5})$/`, 7자리 숫자 등 폴백) (iter-70) |
| `cargo: command not found`                     | PATH 미설정                                    | `export PATH=$HOME/.cargo/bin:$PATH`                             |
| `Cannot connect to Docker daemon`              | Docker Desktop 미실행                          | `open -a Docker` 후 ~30초 대기                                   |
| `finance-datareader not found`                 | PyPI 패키지명                                  | `finance-datareader` (하이픈)                                    |
| `Cannot switch to pnpm@9`                      | 무효 버전 핀                                   | `pnpm@9.15.0` (수정 완료)                                        |
| pytest mock 오염                               | 공유 DataFrame in-place 변형                   | `df.rename(columns=str.lower)` 비파괴                            |
| bff `Cannot find name 'process'`(TS2580)       | bff 에 `@types/node` 누락                      | devDeps `@types/node` + tsconfig `types:["node"]` (수정 완료)    |
| `pnpm install --offline` 가 node_modules purge | 부유 버전(`19.x`) 재해석 → 전이의존성 미스토어 | 온라인 `pnpm install` 또는 `--frozen-lockfile`. `--offline` 지양 |
| `make mpm-stop` 후 :3000 잔존                  | `next dev` 워커가 프로세스그룹 escape          | stop=honcho graceful + 그룹 SIGTERM sweep (수정 완료)            |

## 프로덕션 배포 가이드

> ⚠️ **보안 원칙**: 실 시크릿(DB 비밀번호, API 키, JWT 시크릿 등)은 파일에 절대 기재하지 않습니다.
> HashiCorp Vault 또는 K8s External Secrets Operator를 통해 런타임 주입합니다.

### `make prod-all` — Docker Compose 프로덕션 기동

| 명령 | 동작 |
|------|------|
| `make prod-all` | 인프라(postgres+redis) + 전체 앱 컨테이너 기동 (`ENV=prod` 고정) |
| `make prod-stop` | 전 컨테이너 중지 |
| `make prod-logs` | 통합 로그 tail |
| `make prod-status` | 컨테이너 상태 확인 |
| `make prod-build` | 이미지 빌드 |

```bash
export AUTH_JWT_SECRET=$(openssl rand -base64 32)
make prod-all
```

> `make local-all ENV=prod` 은 호스트 직접 실행(호스트 프로세스), `make prod-all` 은 Docker Compose 컨테이너 실행. 역할 다름.
> K8s Helm 배포는 `make deploy` → `helm upgrade --install stock-trader ./deploy/helm`.

### 환경 설정 — `.env.prod`

```bash
# .env.prod — 값 플레이스홀더만 기재, 실값은 Vault/External Secrets가 주입
APP_ENV=prod
DATABASE_URL=${DATABASE_URL}         # Vault → K8s Secret → 파드 env
REDIS_URL=${REDIS_URL}
ENV=prod
RISK_ENGINE_PORT=3001
NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ANALYSIS_URL=${ANALYSIS_URL}
RAG_URL=${RAG_URL}
INGEST_URL=${INGEST_URL}
# 모든 시크릿: K8s Secret → External Secrets Operator → Vault
```

### A) Docker Compose 프로덕션 기동

```bash
# 1. 이미지 빌드 (레지스트리 푸시 없이 로컬)
make build ENV=prod

# 2. 인프라(postgres + redis) 먼저 기동
make up ENV=prod

# 3. 앱 서비스 전체 기동 (app 프로파일)
make up-app ENV=prod

# 4. 종료
make down ENV=prod
```

### B) K8s + Helm 배포 흐름

```
[소스코드] → docker build → [컨테이너 레지스트리]
                                    ↓
[Helm chart] → helm upgrade → [K8s Deployment/Service]
                                    ↓
[External Secrets Operator] ← [HashiCorp Vault]
          ↓ 동기화
[K8s Secret] → 파드 env 주입
```

```bash
# 전제: kubectl, helm, K8s 클러스터 구성 완료
# 1. Helm 차트 배포
make deploy

# 2. 또는 직접 실행
helm upgrade --install stock-trader ./deploy/helm \
  --namespace stock-trader \
  --create-namespace \
  --values deploy/helm/values-prod.yaml
```

### C) HashiCorp Vault + K8s External Secrets 주입 방법

#### 1단계 — Vault에 시크릿 저장

```bash
# Vault 로그인 (OIDC/AppRole 등 조직 정책에 따라)
vault login

# KV v2 엔진에 시크릿 저장
vault kv put secret/stock-trader/prod \
  DATABASE_URL="postgresql://user:pass@host:5432/stock_trader" \
  REDIS_URL="redis://:pass@host:6379/0" \
  JWT_SECRET="..." \
  OPENAI_API_KEY="..."
```

#### 2단계 — External Secrets Operator 설치

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace
```

#### 3단계 — SecretStore (Vault 연결) 생성

```yaml
# deploy/k8s/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: stock-trader
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "stock-trader-prod"
```

#### 4단계 — ExternalSecret (자동 K8s Secret 생성)

```yaml
# deploy/k8s/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: stock-trader-secrets
  namespace: stock-trader
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: stock-trader-prod-secrets   # ← 생성될 K8s Secret 이름
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef: { key: stock-trader/prod, property: DATABASE_URL }
    - secretKey: REDIS_URL
      remoteRef: { key: stock-trader/prod, property: REDIS_URL }
    - secretKey: JWT_SECRET
      remoteRef: { key: stock-trader/prod, property: JWT_SECRET }
```

#### 5단계 — Helm values에서 Secret 참조

```yaml
# deploy/helm/values-prod.yaml
envFrom:
  - secretRef:
      name: stock-trader-prod-secrets   # ExternalSecret이 생성한 K8s Secret
```

파드는 `DATABASE_URL`, `REDIS_URL` 등을 환경변수로 자동 수신합니다. 파일(`.env.prod`)에는 실값이 없으므로 Git 커밋 안전.

### 시크릿 로테이션

Vault에서 시크릿을 갱신하면 External Secrets Operator가 `refreshInterval`(기본 1h)마다 K8s Secret을 자동 동기화합니다. 파드 재시작 없이 반영하려면 Reloader(Stakater) 연동을 권장합니다.

---

## 다음 단계 (PRD v2 로드맵)

| 단계    | 항목        | 내용                                                                                                                                                                                                                               |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —       | F5 RL       | GAE 정규화클립·앙상블 (✅ 영속 워커풀·공유메모리 텐서 — 차수20)                                                                                                                                                                    |
| —       | 가상체결    | 위상보존 Schur 클리핑 (✅ 계정 다중화 — 차수23 / Schur 클리핑은 companion 역사상 불가로 보류, result/23 근거)                                                                                                                      |
| —       | 실거래      | 증권사 실주문 체결 연동 (현재는 가상/시뮬레이션 체결만, **실자금·외부송출 금지**)                                                                                                                                                  |
| Phase A | 데이터 수집 | ✅ A-1 KRX OPEN API 클라이언트 · ✅ A-2 일별 배치 스케줄러+DB(iter-30) — A-3 전체 히스토리 초기적재, A-4 KIS WebSocket 실연동 잔여                                                                                                 |
| Phase B | 시장경보    | ✅ B-1 KRX 시장경보 수집기(iter-31) · ✅ B-2 긴급청산 트리거 Rust(iter-32) · ✅ B-3 공매도 일별 통계(iter-31) · ✅ B-4 공매도 과열 포지션 축소(iter-32) · ✅ B-5 TUI 시장경보 배너(iter-32) · ✅ B-6 웹 대시보드 실데이터(iter-32) |
| Phase C | 분석 고도화 | ✅ C-1 VWAP·close_pct(iter-33) · ✅ C-2 Breadth TRIN·ADLine(iter-33) · ✅ C-3 FlowAgent 수급분석(iter-33) · ✅ C-4 AlertAgent 경보 override(iter-33) · ✅ C-5 80종 signal/close 필터(iter-33) · ✅ C-6 max_short_ratio(iter-33)    |
| Phase D | ESG·리포트  | ✅ D-1 ESG 프록시 점수(iter-34) · ✅ D-2 IR보고서 RAG(iter-34) · ✅ D-3 분봉 수집(iter-34) · ✅ D-4 분봉 지표(iter-34) · ✅ D-5 ESG 위젯(iter-34) · ✅ D-6 ESG 스크리너(iter-34)                                                   |

> 차수72 완료: ✅ F9.5 멀티계좌 계좌 sync 전면 수정 + TopBar 중복 key 버그 수정
> - **계좌 상태 영속화**: `lib/account.ts` 신규(`getAccount`/`setStoredAccount`, localStorage `st_account` + storage 이벤트)
> - **포트폴리오 페이지**: 진입 시 `localStorage` 복원(항상 default로 초기화되던 버그 수정), 탭 전환 시 `setStoredAccount()` 저장
> - **SimulationPanel**: 선택 계좌 기준 예수금 조회(`?account=`) + 매수/매도 체결(`?account=`), storage 이벤트 구독으로 실시간 동기화, 비-default 계좌 배지 표시
> - **MyPagePanel CashTab**: 단일 effect로 경쟁 상태 제거(AbortController), 선택 계좌 잔여예수금 표시, 비-default → `/api/paper/set-cash?account=` 직접 호출
> - **BFF**: `POST /api/paper/execute` `?account=` 쿼리 포워딩 추가
> - **TopBar**: 자동완성 `key={s.ticker}` → `key={\`${s.ticker}-${i}\`}` (중복 ticker 시 React key 충돌 버그 수정)

> 차수71 완료: ✅ F9.5 포트폴리오 멀티계좌 기능 추가
> - **포트폴리오 탭 바**: 선택계좌 파란색, 나머지 회색 — 선택 시 제일 앞 배치
> - **`+` 버튼**: 계좌명 입력 prompt → `POST /api/paper/set-cash?account=<name>` — 회원가입 시 설정한 초기 예수금 동일 적용 (Rust `with_account_book` 자동 생성)
> - **`−` 버튼**: confirm 확인 후 `DELETE /api/portfolio/account/<name>` — 보유 포지션 포함 삭제, default 계좌 삭제 불가
> - **BFF 신규 라우트**: `GET /api/paper/accounts`, `DELETE /api/portfolio/account/:name`, `POST /paper/set-cash?account=` 쿼리 포워딩
> - **Rust**: `remove_account()` 추가 + `DELETE /paper/account/:name` 엔드포인트

> 차수70 완료: ✅ 예수금 prod-build 재기동 후 초기화 버그 근본 수정
> - **근본 원인**: Postgres 모드에서 `replay(&fills)` 가 `INITIAL_CASH=100_000_000` 상수에서 시작해 체결 이력만 재계산 — 사용자가 `/paper/set-cash` 로 변경한 초기 예수금이 postgres 에 저장되지 않아 재기동 시 항상 1억원으로 초기화됨
> - **수정**: `paper_db.rs` — `paper_settings (key text PK, value text)` 테이블 추가·`save_setting` / `load_setting` 함수 추가
> - **수정**: `main.rs` 시작 시 — fills replay 완료 후 `paper_settings.initial_cash` 로드 → `cash = (initial_cash − cost_basis).max(0)` 재조정
> - **수정**: `paper_set_cash` 핸들러 — Postgres 모드에서 `initial_cash` 를 `paper_settings` 에 UPSERT. 비-Postgres(local) 에서는 기존 스냅샷 파일 방식 유지
>
> 차수69 완료: ✅ F8.16 자동로그인 암호화 자격증명 저장
> - **문제**: JWT 만료 후 재방문 시 자동로그인 체크해도 비밀번호 재입력 필요 — 토큰만 저장, 자격증명 미저장
> - **수정**: `auth-client.ts` — Web Crypto API AES-256-GCM(PBKDF2 키 도출) `saveEncryptedCreds`/`loadEncryptedCreds`/`clearEncryptedCreds` 추가
> - **수정**: `login/page.tsx` — 자동로그인 체크 시 암호화 자격증명 저장. 마운트 시 저장된 자격증명 복호화 → 자동 `/api/auth/login` 호출 → 성공 시 홈 이동. 실패(비밀번호 변경 등) 시 자격증명 무효화 후 폼 표시. "자동 로그인 중…" 로딩 UI 추가
> - **수정**: `clearSession` — 로그아웃 시 저장 자격증명 자동 삭제(`clearCreds=true`)
> - pub-Stock-Trader 동일 수정 반영
>
> 차수68 완료: ✅ 예수금 동기화 복구·db-reset 볼륨 삭제·BFF 연결 오류 3종 수정
> - **예수금 sync**: `login/route.ts` 로그인 성공 시 `BFF POST /api/paper/set-cash` 추가 — 회원가입 시 risk-engine 미기동으로 sync 실패했을 경우 로그인 때 복구
> - **db-reset prod**: `docker volume rm` 전 `docker compose --profile app down` + `docker compose down` 선행 추가 — 컨테이너 실행 중 볼륨 삭제 실패("volume is in use") 해소
> - **BFF 연결 배너**: `NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_BFF_URL` 통일 (`.env.local`·`.env.prod`) + `getSnapshot` `AbortSignal.timeout(5000)` 추가 + 배너 메시지에 `make local-all`/`make prod-all` 안내 추가
> - pub-Stock-Trader 동일 수정 반영
>
> 차수67 완료: ✅ 대시보드 종목 검색 ticker 오염 버그 수정 (400/500 오류)
> - **근본 원인 ①**: `TopBar.tsx` `handleSubmit` else 분기 — 6자리 숫자 아니고 suggestions 없을 때 `navigate(t)` 로 raw 입력(한글 회사명 등)이 `st_ticker` 쿠키에 저장 → `/api/candles/%EC%...` 400 오류
> - **근본 원인 ②**: `page.tsx` — `cookieStore.get('st_ticker')?.value` 무검증 그대로 전체 BFF 호출 전달 → 쿠키 오염 시 500 오류
> - **수정 ①**: `handleSubmit` else → `searchStocks(t,1)` 로컬 DB 폴백, 결과 있으면 `handleSelect`, 없으면 이동 안 함
> - **수정 ②**: `page.tsx` ticker regex 검증 `/^[A-Za-z0-9]{1,20}$/` 추가 — 무효 시 `005930` 폴백
> - pub-Stock-Trader 동일 수정 반영
>
> 차수66 완료: ✅ `make db-reset` dev/staging/prod PostgreSQL 미삭제 버그 수정
> - **근본 원인**: `db-reset` non-local 분기에서 `docker volume rm stock-trader_pgdata` 가 `echo` 힌트로만 출력, 실제 실행 안 됨 — auth.db만 삭제되고 PostgreSQL(paper_fills·pgvector·OHLCV) 잔존
> - **수정**: `pgdata` 볼륨 실제 삭제 실행 추가. pub-Stock-Trader 동일 수정 반영
>
> 차수65 완료: ✅ F8.15 회원가입 예수금 risk-engine 미반영 버그 수정
> - **근본 원인**: `register/route.ts`가 SQLite(`auth.db`)에 `initial_cash` 저장 후 risk-engine `POST /paper/set-cash` sync 누락 — 회원가입 시 입력한 예수금과 무관하게 risk-engine은 기본값(1억) 유지
> - **수정**: `register/route.ts`에 `change-cash/route.ts`와 동일한 BFF→risk-engine cash sync 추가 (2s timeout, 미기동 시 무시)
>
> 차수64 완료: ✅ 환경별 구동 방식 수정 + F8.14 회원가입 예수금 step 유효값 오류 수정 + prod-* Makefile 타겟 추가
> - **docker-compose.yml env_file 기본값 수정**: `env_file: [".env.${ENV:-dev}"]` → `[".env.${ENV:-local}"]` (7개 서비스) — ENV 미지정 시 `.env.dev` 로드 시도 실패 버그
> - **postgres healthcheck DB명 추가**: `pg_isready -U app` → `pg_isready -U app -d stock_trader` — DB 없이 포트만 열린 상태를 healthy로 오판하던 버그 해소
> - **예수금 `min` 수정**: 회원가입 폼 `min="1"` → `min="1000000"` — `step=1000000`과 불일치로 15000000 등 정상값이 "유효하지 않은 값" 브라우저 오류 표시되던 버그
> - **prod-* Makefile 타겟 추가**: `prod-all`·`prod-stop`·`prod-logs`·`prod-status`·`prod-build` — Docker Compose 프로덕션 전용 단축키
> - **누락 env 파일 추가**: `.env.example`·`.env.prod`(루트)·`core/risk-engine/.env.prod`
>
> 차수63 완료: ✅ F10.1 사이드바 서비스 상태 실시간 헬스체크
> - **원인**: `StatusDot` 하드코딩(`var(--color-up)` = 적색) → 실제 상태와 무관하게 항상 적색 표시
> - **BFF 신규 엔드포인트**: `GET /api/services/health` — ingest·analysis·agents·risk 병렬 헬스체크(2s timeout)
> - **Sidebar 폴링**: 30초 간격 자동 갱신, 절대 색상 사용(UP=#3fb950 초록, DOWN=#f85149 적색, 확인중=회색) — 주식 색상 변수 간섭 없음. 툴팁에 정상/연결불가 상태 표시
>
> 차수63 완료: ✅ Docker prod 환경 구성 + F8.13 회원가입 예수금 입력 버그 수정
> - **Docker prod 구성**: BFF/Dashboard Dockerfile 신규 생성(pnpm workspace 멀티스테이지·Next.js standalone). `.env.prod` 서비스 내부 URL 보완(`BFF_URL=http://bff:3002`, `AGENTS_URL`, `RISK_ENGINE_URL`). `make down` `--profile app` 누락 수정(앱 컨테이너 미종료 버그). `next.config.ts` `BFF_URL` 빌드타임 베이킹 제거 → 런타임 주입. `docker-compose.yml` `AUTH_JWT_SECRET` 쉘 주입 + `dashboard-data` 볼륨(auth.db 영속화). `web/.dockerignore` 로컬 data/ 제외
> - **예수금 입력 버그 수정**: 회원가입 폼 예수금 입력 `type="text"+toLocaleString` 제어 커서 리셋 → `type="number"` 교체. 사용자가 입력한 값 대신 초기값(1억원)이 제출되던 버그 해소
>
> 차수62 완료: ✅ F5 백테스팅 화면 통합 + API 응답 매핑 수정
> - **백테스팅 통합**: `/backtest` 페이지에 규칙기반(SMA교차·RSI임계·MACD·Q-러닝) + 강화학습(DQN/PPO/A2C/QR-DQN) 2탭 통합. 종목코드 공유, 규칙기반 자동실행, 거래내역 펼침 표시
> - **API 매핑 수정**: 분석 서비스 raw 응답(`total_return_pct`이미 ×100, `num_trades`) → UI 필드(`total_return`, `total_trades`) 정확 변환. 결과 미표시 버그 해결
> - **전략/스크리너 정리**: 백테스트 중복 탭 제거 → "↺ 백테스팅 →" 배너로 페이지 연결. 스크리너 전용 페이지로 단순화
>
> 차수61 완료: ✅ F9.4 전략/스크리너 화면 전면 개선 + 행 클릭 버그 수정
> - **스크리너 탭 필터 확장**: RSI 최소/최대·최소 거래량·종가 하한/상한 4개 필터 추가 (백엔드 기존 지원 항목 UI 노출)
> - **전략 백테스트 탭 신규**: 규칙기반(SMA교차·RSI임계·MACD·Q-러닝) + 강화학습(DQN·PPO·A2C·QR-DQN) 전략 선택·실행. 결과: 총수익률·연환산·샤프지수·최대낙폭·승률·거래횟수 카드 표시
> - **BFF 신규 라우트**: `POST /api/backtest/rl` — `algo` 파라미터로 DQN/PPO/A2C/QRDQN 분기
> - **행 클릭 버그 수정**: `navigateToTicker` 쿠키 설정 후 `localStorage.st_ticker/st_name`도 동기 설정 → TopBar 종목 표시 즉시 반영. `window.location.assign('/')` 사용
>
> 차수60 완료: ✅ F9.3 포트폴리오·전략/스크리너 행 클릭 → 대시보드 이동 — 보유종목 행 클릭 시 `st_ticker` 쿠키 설정 후 `/`(대시보드) 이동, 매수/매도 즉시 접근. 전략/스크리너 스캔 결과 행도 동일. TS clean.
>
> 차수59 완료: ✅ F8.11 버그수정 재시작 영속화 강화 — `tokio::spawn` 비동기 저장→동기 호출로 변경(SIGINT 전 완료 보장). SIGINT/SIGTERM graceful shutdown 훅 추가(종료 전 최종 스냅샷 저장). 원자적 파일 쓰기(`.tmp`→rename). Rust 81/81 PASS.
>
> 차수58 완료: ✅ F8.12 포트폴리오 예수금 표시 정합성 — 마이페이지 예수금 입력 초기값을 `user.initial_cash`(설정값)→`portfolio.cash`(risk-engine 실제 잔여)로 변경. 라벨 "잔여예수금"·"총 자산(예수금+평가)" 명확화. 총 자산 = 잔여예수금 + 포지션시가합계. TS clean.
>
> 차수57 완료: ✅ F8.11 페이퍼 트레이딩 재시작 영속화 — `data/paper_book.json` JSON 스냅샷. postgres 없는 로컬 환경에서 체결·예수금 변경 시 자동 저장, 재시작 시 포지션·예수금·실현손익 복원. `PaperBookSnapshot` Serde 직렬화. Rust 81/81 PASS.
>
> 차수56 완료: ✅ F7.10 매수 수수료 취득원가 포함 — `cost_basis += fill_price×qty + fee`, `avg_price = (prev_cost + fill_price×qty + fee) / new_qty`. 즉시 매도 시 수수료(매수+매도) 반영된 손익 표시. Rust 81/81 PASS.
>
> 차수55 완료: ✅ F6.3 색상 한국 주식시장 관례 — 상승(+)=적색, 하락(−)=파란색. `globals.css` `--color-up: #f85149`, `--color-down: #388bfd`(다크); `#cf222e`/`#0969da`(라이트). 포트폴리오 범례 수정. MiniCandleChart 하드코딩 색상 반영. TS clean.
>
> 차수54 완료: ✅ F7.9 포트폴리오 개선 — 컬럼 "평균단가"→"매수시단가"(검증 명확화). 합계 행 추가(매수총금액·매도총금액·평가손익·수익률·100%). 페이퍼 트레이딩 슬리피지 0(`SLIPPAGE_BPS=0.0`) — 화면 가격 그대로 체결. Rust 81/81 PASS, TS clean.
>
> 차수53 완료: ✅ F7.8 SimulationPanel 종목 변경 시 초기화 — `useEffect([ticker])`로 수량→1, 체결결과→null, 오류→'' 자동 리셋. TopBar 종목코드 조회 시 이전 체결내역 즉시 초기화. TS clean.
>
> 차수52 완료: ✅ F7.5 최종 레이아웃 — SimulationPanel 2행: 행1=`(현재주가) X원 · 수량 [input] · = Y원`(예수금 초과 시 Y원 적색+볼드), 행2=`예수금 Z원(소형9px)` + `[▲매수][▼매도]` 우측. TS clean.
>
> 차수51 완료: ✅ F7.5 레이아웃 확정 — SimulationPanel 단일 행: `(현재주가) X원  수량 [input]  = Y원  [▲매수] [▼매도]`. 예수금 소형(9px) 하단 표시. TS clean.
>
> 차수50 완료: ✅ F7.5 재설계 확정 — SimulationPanel 좌우 2열 레이아웃. 좌: 3행(현재주가·수량 number input·= 금액). 우: ▲매수/▼매도 버튼 세로 정렬. 예수금 3행 아래 표시. 라벨 '매수/매도가격' 제거·'= 결과값'으로 간소화. TS clean.
>
> 차수49 완료: ✅ F7.4 수량입력 `type="number"` 복원 — 브라우저 기본 스피너(위아래 화살표) 사용. 커스텀 `▼`/`▲` 버튼 제거. ESG·공매도 필터와 동일한 입력 UX. TS clean.
>
> 차수48 완료: ✅ F7.4 재설계 — SimulationPanel 3항목 수직 배치(현재주가·수량·매수/매도가격). 수량 스텝 버튼 `−`/`＋` → `▼`/`▲` 화살표로 교체. 매수/매도 버튼 하단 독립 행. TS clean.
>
> 차수47 완료: ✅ F7.4 보완 — SimulationPanel 수량 `−`/`＋` 스텝 버튼 추가(`stepQty(±1)`, 0 미만 방지). `type="text"` select-all UX 유지하면서 수동 증감 가능. TS clean.
>
> 차수46 완료: ✅ F6.2.13 확장 — Sidebar 서브페이지 메뉴 링크에서 `?ticker=...&persona=...` 쿼리스트링 완전 제거. 메뉴 `<Link href={item.href}>` 순수 경로 사용. 페르소나 선택기 `<Link>` → `<button onClick={handlePersonaChange}>` 전환(cookie `st_persona` 설정 + `router.push('/')`). `useSearchParams` 제거, `useEffect`로 cookie 읽어 현재 페르소나 하이라이트. 포트폴리오·전략·리스크·백테스팅·에이전트 등 전 서브페이지 주소창 파라미터 노출 없음. TS clean.
>
> 차수45 완료: ✅ F6.2.13 URL 파라미터 숨김 — ticker·persona를 URL 쿼리스트링 대신 쿠키(`st_ticker`/`st_persona`, 30일)로 전달. TopBar `navigate()` → `document.cookie` 설정 후 `router.push('/')` · `app/page.tsx` → `next/headers cookies()` 읽기(searchParams 프롭 제거). 주소창 항상 `/` 표시(`/login`, `/register` 제외). TS clean.
>
> 차수44 완료: ✅ F7.7 포트폴리오 매수총금액 = 매수시단가×수량 — Rust `Position`에 `cost_basis: f64` 필드 추가(매수 시 `+= fill_price × qty`, 매도 시 비례 차감, 전청산 시 0). 포트폴리오 UI `buy_amount` 컬럼을 `cost_basis` 우선 표시(fallback: `avg_price × qty`). 범례 "매수총금액 = 매수시단가×수량"으로 변경. Rust cargo check clean.
>
> 차수43 완료: ✅ F7.6 예수금 sync 버그 수정 — `change-cash/route.ts` fire-and-forget → `await`(try/catch) 변경으로 race condition 해소. `ClientLayout.tsx` `localStorage.getItem('st_token')` → `getToken()` 교체(auth-client 듀얼-스토어 적용). TS clean.
>
> 차수42 완료: ✅ F8.10 로그인 아이디 기억하기 + 자동로그인 — `auth-client.ts` `storeSession(autologin)`: true→localStorage/false→sessionStorage. `getToken()`·`getStoredUser()` localStorage 우선 후 sessionStorage fallback. `saveRememberEmail`/`getRememberedEmail`/`saveAutoLoginPref`/`getAutoLoginPref` 함수 추가. `/login` 페이지 체크박스 2개(아이디 기억하기·자동로그인) + `CheckOption` 서브컴포넌트. TS clean.
>
> 차수41 완료: ✅ 예수금 동기화 — Rust `POST /paper/set-cash` 신규 엔드포인트 + BFF `/api/paper/set-cash` 프록시 + Next.js `change-cash` API에서 risk-engine cash sync(fire-and-forget). MyPage 예수금 변경 시 현재 매수총금액 조회 후 floor 자동 적용(매수총금액 미만 입력 시 매수총금액으로 자동 조정).
>
> 차수40 완료: ✅ TopBar 사용자별 종목조회 히스토리(localStorage `st_ticker_history_{userId}`, 빈 입력 포커스 시 드롭다운, 최대 10건, 단건/전체 삭제) · SimulationPanel 수량입력 UX 개선(type=text select-all, qty=0 alert, 예수금 부족 사전 검증) · SimulationPanel 레이아웃 인라인화(수량+금액+버튼 1행·버튼 50% 소형화·하단 패널 높이 정렬).
>
> 차수39 완료: ✅ DB 영속(better-sqlite3→node:sqlite Node 24 내장·ABI 충돌 해소, globalThis.\_\_authDb HMR 싱글톤) · `make db-reset` 추가 · 포트폴리오 일봉 캔들 미니차트 카루셀(MiniCandleChart SVG·보유종목별·좌우 화살표 스크롤·박스 가이드선) · 포트폴리오 매수총금액·매도총금액 컬럼·범례 · 전략·리스크·백테스팅·에이전트 페이지 모듈-레벨 상태 영속(종목코드 변경 시만 재조회) · 에이전트 페르소나 `scalp`/`safe` 추가(UI 표준명 정렬, 500 오류 수정, 9 tests pass).
>
> 차수38 완료: ✅ F8 사용자 인증 — 회원가입(/register: 이메일·성명·비밀번호·예수금 기본 1억원·TOTP QR 확인) · 로그인(/login: bcryptjs·jose JWT 7일·TOTP 2FA) · AuthGuard ClientLayout(비로그인 접근 차단→/login 리다이렉트) · Sidebar 하단 사용자 이름 클릭 → 마이페이지 롤업 패널(비밀번호 변경·예수금 변경·TOTP 등록) · 로그아웃 · 7개 API Route Handler(register/login/me/change-password/change-cash/totp/qr/totp/enable) · SQLite(better-sqlite3 auth.db) · 백테스팅 qlearn 전략 500 오류 수정(rl_backtest_ticker 자동 위임) · Rust INITIAL_CASH 1천만→1억원 · TS clean.
>
> 차수37 완료: ✅ F6.2.11 보완 — Q1 장마감 후 최근 거래일 데이터 표시·마우스 휠 줌·가격 툴팁·Y축 눈금 · Q2 시간대별 수익률 오류 수정(일별 개장가 대비 누적 수익률, 인트라데이 fallback 선형보간 개선) · Q2/Q3 Y축 배율 줌(스크롤) · 전 사분면 X/Y축 레이블 · ⛶ 팝업 확대 Modal(ESC 닫기) · QUAD_H=330(총 660px, ESG 정렬 복원) · TS clean.
>
> 차수36 완료: ✅ F6.2.11 4분면 캔들 차트(CandleChart4: Q1 금일 5분봉 실시간 선형차트 / Q2 시간대별 평균수익률 바차트 / Q3 요일별 평균수익률 바차트 / Q4 기존 일봉 캔들) · F7.3 SIMULATION 예수금 추적(초기 1천만원, 매수차감/매도가산 — Rust PaperBook.cash) · 포트폴리오 BFF 보강(현재가·종목명·손익·비중 병렬조회) · 서브페이지(백테스팅·에이전트) 마운트 시 자동조회 · Makefile local-dev/local-staging 단축키 · TS 전 파일 clean.
>
> 차수35 완료: ✅ F7 시뮬레이션 매수/매도 — 대시보드 하단 매수▲/매도▼ 패널(SimulationPanel, BFF POST /api/paper/execute) · 포트폴리오 반영 · F6.2.9 TopBar 종목코드+기업명 표시(localStorage st_ticker/st_name 영속, 정적 미포함 종목 BFF 동적 조회, mounted 플래그 SSR 하이드레이션 수정) · F6.2.10 리스크·백테스팅·에이전트 서브페이지 대시보드 선택 종목 컨텍스트 유지+기업명 표시 · TS 전 파일 clean.
> 차수34 완료: ✅ Phase D 전체 완성 — D-1 ESG 프록시 점수 API(E/S/G 3항목, 6h 캐시) · D-2 한국IR협의회 AI 분석보고서 RAG(POST/GET /rag/ir-report) · D-3 분봉 수집(FDR+일봉 downsampling fallback, 1m/5m) · D-4 분봉 지표(RSI/MACD/VWAP) · D-5 대시보드 ESG 위젯(E/S/G 바 차트) · D-6 스크리너 min_esg_score 필터 · 서브페이지 5종 실API 연결(전략·에이전트·백테스팅·리스크·포트폴리오) · BFF portfolio/rag/ir-report 라우트 추가 · ingest 168·analysis 137·agents 39·rag 6 PASS.
> 차수33 완료: ✅ Phase C 전체 완성 — C-1 VWAP(20)·close_pct 지표(analysis) · C-2 Breadth API TRIN·ADLine · C-3 FlowAgent 수급분석(기관+외인 3일 순매수) · C-4 AlertAgent 경보 override(위험→SELL, 경고→HOLD) · C-5 80종 signal/close 필터 스크리너 · C-6 max_short_ratio 필터 · 6-에이전트 파이프라인 · 대시보드 VWAP/Close% 패널 · shortSell.rows undefined 런타임 오류 수정 · 하단 패널 캔들차트 하단 배치 · 합계 520→529.
> 차수32 완료: ✅ Phase B-2 시장경보 긴급청산 트리거(market_alert_level→ForceSell/BlockBuy, /risk/alert-check) · ✅ B-4 공매도 과열 포지션 축소(short_ratio_limit→ReducePosition) · ✅ B-5 TUI 시장경보 배너(AlertItem, 4단 레이아웃, 색상코딩) · ✅ B-6 웹 대시보드 실데이터(시장경보 패널 레벨 배지, 공매도 비율 표) · MACD [object Object] 버그 수정(indicators 타입 재정의) · Rust 72→81, 합계 511→520.
> 차수31 완료: ✅ Phase B-1 KRX 시장경보 수집기(KIND POST, MarketAlertDaily, /krx/market-alerts) · ✅ Phase B-3 공매도 일별 통계(ShortSellingDaily, /krx/short-selling) · ✅ 종목 DB 동적화(FDR 전종목 24h캐시, /krx/stocks/search, BFF 프록시, TopBar BFF 동적검색) · ✅ market badge KOSPI/KOSDAQ 동적 · ingest 144→168, 합계 487→511.
> 차수30 완료: ✅ Phase A-2 일별 배치 스케줄러+DB 스키마(APScheduler 15:40 KST·OhlcvDaily·InvestorFlowDaily·upsert·/scheduler/status/run) · ingest 128→144, 합계 471→487.
> 차수29 완료: ✅ 툴팁 하단 클리핑 방어(ref 높이 측정 + 위로 flip) · ✅ 기업명/코드 통합 검색 autocomplete(lib/stocks.ts 165종목·searchStocks, TopBar 드롭다운) · ✅ 캔들 차트 개선(X/Y축·반응형 ResizeObserver·스크롤 줌·nice interval 가격눈금·패딩 범위) · Web 50→68 테스트.
> 차수28 완료: ✅ 대시보드 전체 UI 40개 항목 인라인 툴팁 시스템 — Tooltip 컴포넌트(position:fixed·260ms delay·viewport flip) + TOOLTIPS 사전(페르소나4·메뉴6·서비스4·지표6·MetricCard5·패널7·리스크3·수급3·배지2) · Web 32→50 테스트.
> 차수27 완료: ✅ 캔들차트 툴팁 수정(position:fixed + viewport 좌표 — overflow·stacking 문제 해소) · ✅ F1.5 KRX OPEN API 수집기(KrxOpenApiService, /krx/ohlcv, /krx/investor-flow, /krx/status) · ingest +23 테스트(총 128). Python 282→305.
> 차수26 완료: ✅ Phase 0 — 다크/라이트 테마 토글(ThemeProvider·localStorage) · 캔들차트 마우스오버 툴팁(OHLCV·등락률·flip) · 시계 1초 틱 · 서브페이지 5개(포트폴리오/전략/리스크/백테스팅/에이전트) 404 해소 · TS 오류 2건 수정. 웹 테스트 26→32(+6 findCandleIndex). PRD v2 F6.2 업데이트.
> 차수25 완료: bff `@types/node` + MPM 백그라운드 관리자(`make mpm`/`mpm-stop`/`mpm-status`/`mpm-logs`, +5). E2E 7서비스 기동·정상종료 확인.
> 차수23 완료: ✅ F5 가상체결 계정 다중화 — `?account=` 격리 원장·계정별 halt/청산·`GET /paper/accounts`(기본 계정만 DB 영속).
> 차수22 완료: ✅ F2.2 고도화 — 적응 격자 QuEST(`erc_quest_adaptive`)·MP 적합도검정(`marchenko_pastur_gof`)·팩터모델 타깃(`erc_factor`).
> 차수21 완료: ✅ F1.2 흐름제어 → `SubscriptionManager` 토큰버킷 통합(AIMD rate·우선순위 명령큐·백프레셔, 옵트인·하위호환).
> 차수20 완료(다음 단계): ✅ F3.3 자가교정 · ✅ F6.2 실시간 캔들 · ✅ F6.3 양방향 제어 · ✅ F1.2 AIMD·우선순위큐·백프레셔 · ✅ MPM-RL 영속 워커풀+공유메모리 · ✅ MPM-dev(`make dev-all`).
