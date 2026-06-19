**English** | [한국어](README.md)

# Stock Trader AI Platform

> Real-time stock trading AI platform — Finance domain (KSIC K).
> Compliance: 전자금융감독규정 · ISMS-P · PCI-DSS 4.0.1 → [COMPLIANCE.md](COMPLIANCE.md)

## Overview

profile: `python-fastapi` (+ `rust-axum` core, `node-next-nest` web) · domain: `finance`

| Doc | Link |
|-----|------|
| PRD v2 | [.docs/Stock-Trader-PRD.v2.md](.docs/Stock-Trader-PRD.v2.md) |
| KRX site analysis | [.docs/krx-refer/Analysis-site.md](.docs/krx-refer/Analysis-site.md) |
| Compliance guide | [COMPLIANCE.md](COMPLIANCE.md) |
| Env template | [.env.example](.env.example) |
| Test results | [test/impl/27/result.md](test/impl/27/result.md) |

![Stock Trader AI Platform Demo](.docs/Stock-Trader.gif)

## Implementation Status (PRD mapping)

| Feature | Service | Status | Notes |
|---------|---------|--------|-------|
| F1.1 Price/OHLCV/tickers | ingest | ✅ | FinanceDataReader |
| F1.2 Order book | ingest | ✅ | Price-based simulation |
| F1.2 Broker WS feed | ingest | ✅ | Real WS / random-walk sim fallback |
| F1.2 Adaptive flow control | ingest | ✅ | **AIMD rate + priority queue + backpressure** — integrated into `SubscriptionManager` token bucket (opt-in) |
| F1.5 KRX OPEN API collector | ingest | ✅ | 2-step OTP→data, OHLCV + investor flow, fallback when key not set |
| F1.3 News RSS | ingest | ✅ | feedparser |
| F1.4 FastMCP | ingest | ✅ | Claude/Gemini integration |
| F2.1 Indicators | analysis | ✅ | RSI·MACD·Bollinger·EMA·SMA·ATR |
| F2.2 Prediction | analysis | ✅ | Multivariate (macro 17 modes + **erc_quest_adaptive (adaptive-grid QuEST)·erc_factor (MP factor/noise split)** + MP goodness-of-fit + FinBERT/KR-FinBERT) |
| F2.3 Screener | analysis | ✅ | RSI·volume filters |
| F3.1 Multi-agent | agents | ✅ | Scraper·Analyst·Portfolio·Decision |
| F3.3 Self-correction loop | agents | ✅ | **Strategy-drift monitor (churn·low-confidence·weight-breach) + HOLD downgrade·weight clamp** |
| F3.2 Quant RAG | rag | ✅ | Hybrid search + hallucination block + pgvector persistence |
| F4 Risk engine | risk-engine | ✅ | Stop-Loss·Trailing·daily limit·Fail-Safe |
| F5 Backtesting | analysis | ✅ | Multi-strategy + RL (…·DPG **reinforce/a2c/ppo·GAE**) + **persistent worker pool·shared memory** |
| F5 Paper trading | risk-engine | ✅ | Multi-ticker·rolling·5-factor·full VAR(p)·YW + companion complex eigenvalue QR(Schur) radius projection + **multi-account (isolated per-account ledger)** |
| F6.1 Scalper TUI | apps/tui | ✅ | ratatui order book·P&L |
| F6.2 Web dashboard | web | ✅ | Next.js + NestJS BFF + **4-quadrant candle chart (5m intraday · hourly pattern · weekday pattern · daily candles, iter-36)** + **dark/light theme toggle · tooltips** + **TopBar ticker+name display with localStorage persistence (iter-35)** + sub-page auto-query on mount (risk/backtest/agents, iter-36) |
| F7 Simulation buy/sell | web/risk | ✅ | Dashboard buy▲/sell▼ panel (SimulationPanel) → BFF POST /api/paper/execute → risk-engine paper ledger · **virtual cash tracking (initial ₩100M, deduct on buy / add on sell, iter-38)** → portfolio enriched with current price · name · P&L · weight via BFF (iter-36) |
| F8 User Auth | web | ✅ | Register/Login (bcryptjs + jose JWT + TOTP otplib), default deposit ₩100M, **Sidebar roll-up MyPage** (password · deposit · TOTP), AuthGuard route protection, SQLite (`node:sqlite` Node 24 built-in, `globalThis` HMR singleton) · **register deposit input `type=number` fix** (iter-63) — `iter-38~39` |
| F6.3 Alerts | agents | ✅ | Telegram/Discord webhook |
| F6.3 Two-way control | agents + risk-engine | ✅ | **remote bot stop(halt)/emergency liquidation + inbound commands (secret auth)** |

## Architecture / Service Roles

```
Stock-Trader/
├── services/
│   ├── ingest/     F1 Price·orderbook·news·FastMCP·AIMD flow  :8003  Python/FastAPI
│   ├── analysis/   F2 Indicators·prediction·screener·RL(persistent) :8001  Python/FastAPI
│   ├── rag/        F3.2 Quant RAG                            :8002  Python/FastAPI
│   └── agents/     F3.1 Multi-agent·F3.3 self-correct·F6.3 control :8004  Python/FastAPI
├── core/risk-engine/  F4 Stop-Loss/Trailing·F6.3 halt/liquidate :3001  Rust/Axum
├── Procfile.dev       MPM static orchestration (make dev-all)
├── tools/mpm/         MPM Procfile generator (registry·ENV·groups, make mpm)
├── apps/tui/          F6.1 Scalper console                   Rust/ratatui
└── web/
    ├── apps/dashboard  F6.2 Dashboard                 :3000  Next.js 15
    └── apps/bff        BFF aggregation gateway        :3002  NestJS 11
```

Infrastructure: PostgreSQL 17 (pgvector 0.8.2) + Redis 7.4

## Prerequisites

| Tool | Version (verified) | Check |
|------|--------------------|-------|
| Python | 3.12+ (venv 3.13.12) | `python3 --version` |
| uv | 0.4+ | `uv --version` |
| Node.js | 20 LTS+ (v26) | `node --version` |
| pnpm | 9+ (10.33) | `pnpm --version` |
| Rust/cargo | 1.80+ (1.95) | `cargo --version` |
| Docker Desktop | latest | `docker info` |

> **cargo PATH**: add `export PATH=$HOME/.cargo/bin:$PATH` to `~/.zshrc`

## Environment Setup

```bash
cp .env.example .env.local   # root + each service dir
```

| File | Purpose |
|------|---------|
| `.env.local` | Local direct run (SQLite, optional Redis) |
| `.env.dev` | Docker compose dev (Postgres + Redis) |
| `.env.staging` | Production-equivalent validation |
| `.env.prod` | Key list only — injected by Vault/K8s External Secrets |

> **⚠️ Real broker API Key/Secret → OS Keychain or Vault only. Never write to files.**
> Non-production environments must use synthetic data only (COMPLIANCE.md).

### AUTH_JWT_SECRET Configuration

The dashboard (F8 user auth) requires `AUTH_JWT_SECRET` (random value, 32+ bytes) to sign JWTs.

**Generate:**
```bash
openssl rand -base64 32
```

| Env | Method | Notes |
|-----|--------|-------|
| `local` | Write directly in `.env.local` | Temporary dev value allowed |
| `dev` | Write directly in `.env.dev` | Temporary dev value allowed |
| `staging` | `export` in shell before make | Never write to file |
| `prod` | `export` in shell before make (K8s: injected by Vault automatically) | Never write to file |

> **Docker Compose env_file caveat:** `${AUTH_JWT_SECRET}` in `.env.staging` / `.env.prod` is **not shell-expanded** by Docker Compose. You must `export` the value in your shell before running make.

```bash
# staging / prod — set in shell before Docker Compose
export AUTH_JWT_SECRET=$(openssl rand -base64 32)
make up ENV=staging   # or ENV=prod

# macOS Keychain (long-term storage)
security add-generic-password -a stock-trader -s AUTH_JWT_SECRET \
  -w "$(openssl rand -base64 32)"
export AUTH_JWT_SECRET=$(security find-generic-password \
  -a stock-trader -s AUTH_JWT_SECRET -w)
make up ENV=prod
```

Each service loads its own `.env.local` from CWD via pydantic-settings:
```
services/ingest/.env.local, services/analysis/.env.local, ...
```

## Running

### A) docker compose (multi-service)

```bash
make up                  # infra only (postgres+pgvector, redis). Default ENV=local
make up ENV=dev          # pass ENV → compose picks env_file=.env.dev
make up-app              # full app stack (app profile) as containers
make build               # docker compose --profile app build
make sync                # sync all deps (uv sync + pnpm install)
make dev-ingest          # individual service (uvicorn --reload, volume mount)
make dev-analysis / dev-rag / dev-agents / dev-risk / dev-tui / dev-web
make local-all           # start all services in background (recommended; stops existing first)
make local-stop          # stop all services
make local-logs          # tail aggregated log
make local-status        # process status
make dev-all             # foreground start (blocks terminal, Ctrl-C to stop all)
make down                # stop all
```

### MPM (multi-process manager) — `make local-all` (recommended)

Starts and manages all 6 processes (ingest·analysis·rag·agents·risk·web) from **a single terminal**. Runs honcho through `uvx`, so **no separate install** is needed.

> ⚠️ Running `make local-all` (background) and `make dev-all` (foreground) **at the same time causes port conflicts** and forces services to terminate. Use only one at a time.

```bash
# ── Recommended: background ─────────────────────────────────
make local-all                    # ENV=local start all services in background (stops existing first)
make local-dev                    # ENV=dev shortcut
make local-staging                # ENV=staging shortcut
make local-stop                   # stop all services
make local-logs                   # tail aggregated log (.mpm/mpm.log)
make local-status                 # process status (pid)

# ── Foreground (blocks terminal, colorised log) ──────────────
make dev-all                      # Ctrl-C to stop all

# ── Low-level MPM commands ───────────────────────────────────
make mpm ENV=dev GROUP="py rust"  # dev env, python+rust groups only
make mpm-check ENV=dev GROUP=py   # validate generated Procfile (exit code)
```

> **tools/mpm**: deterministically renders the honcho Procfile per ENV·group from a single service registry (`SERVICES`), and starts/stops/inspects all processes in the **background (detached)**. `make mpm` = `mpm.py up` (Popen `start_new_session` + `.mpm/{Procfile.gen,mpm.pid,mpm.log}`); `make mpm-stop` = honcho SIGTERM (graceful cascade) + session process-group sweep (cleans even detached `next dev` workers). Groups `py` (ingest·analysis·rag·agents)·`rust` (risk)·`web`. ENV substitution (`APP_ENV`·`.env.{env}`). Standard library only (zero deps). State in `.mpm/` (gitignored).

> **ENV passthrough**: all compose targets (`up`/`up-app`/`build`/`down`) pass `ENV=$(ENV)` to docker compose, selecting `.env.$(ENV)`. Rust targets (`dev-risk`/`dev-tui`) load `.env.$(ENV)` as env vars before running.

compose profiles:
- `default`: postgres, redis (`make up`)
- `app`: all service containers (`make up-app`)

### B) Direct host execution

```bash
# Python services (per dir)
cd services/ingest && uv sync --dev && uv run uvicorn app.main:app --reload --port 8003
cd services/analysis && uv run uvicorn app.main:app --reload --port 8001
cd services/rag && uv run uvicorn app.main:app --reload --port 8002
cd services/agents && uv run uvicorn app.main:app --reload --port 8004

# Rust
export PATH=$HOME/.cargo/bin:$PATH
cargo run -p risk-engine        # :3001
cargo run -p tui                # scalper console (terminal)

# FastMCP server (F1.4)
cd services/ingest && uv run mcp run app/services/mcp_server.py

# Web (pnpm workspace)
cd web && pnpm install
pnpm --filter @stock-trader/bff dev         # :3002
pnpm --filter @stock-trader/dashboard dev   # :3000
```

## Port / URL Reference

| Service | URL | Port | Profile | API Docs |
|---------|-----|------|---------|---------|
| ingest | http://localhost:8003 | 8003 | app | [/docs](http://localhost:8003/docs) |
| analysis | http://localhost:8001 | 8001 | app | [/docs](http://localhost:8001/docs) |
| rag | http://localhost:8002 | 8002 | app | [/docs](http://localhost:8002/docs) |
| agents | http://localhost:8004 | 8004 | app | [/docs](http://localhost:8004/docs) |
| risk-engine | http://localhost:3001 | 3001 | app | — |
| bff | http://localhost:3002 | 3002 | — | /api/health |
| dashboard | http://localhost:3000 | 3000 | — | — |
| postgres | localhost:5432 | 5432 | default | — |
| redis | localhost:6379 | 6379 | default | — |

## Dashboard Persona

The `?persona=` query param (dashboard URL and `agents/analyze` API) selects trading style. Persona directly affects risk parameters, position-weight limits, and agent decision thresholds.

| Persona | URL value | Hold period | Notes |
|---------|-----------|-------------|-------|
| Scalper | `scalper` | Seconds – minutes | Ultra-short. Tight stop-loss, rapid entry/exit, high turnover. Minimum weight limit (default 5%). |
| Day Trader | `day` | Intraday (closed EOD) | No overnight. Medium stop-loss, daily P&L limit takes priority. Medium weight limit (default 8%). |
| Swing | `swing` | Days – weeks | Trend-following. Standard stop-loss + trailing stop. Standard weight limit (default 10%). **Default.** |
| Position | `position` | Weeks – months | Long-term hold. Wide stop-loss, macro/fundamental inputs weighted up. Max weight limit (default 15%). |

> Dashboard URL example: `http://localhost:3000/?ticker=005930&persona=scalper`
> Agent API: pass `"persona": "day"` in the `POST /agents/analyze` body.
> Self-correction (`/agents/self_correct`) applies the per-persona weight limit when judging drift.

## API Examples

### F1 ingest
```bash
curl http://localhost:8003/market/price/005930
curl "http://localhost:8003/market/ohlcv/005930?days=30"
curl http://localhost:8003/market/tickers/KRX
curl "http://localhost:8003/orderbook/005930?levels=10"
curl http://localhost:8003/news/sources
curl http://localhost:8003/news/reuters-business?limit=10
```

### F2 analysis + F5 backtesting
```bash
curl "http://localhost:8001/indicators/005930?days=60"
curl http://localhost:8001/predict/005930                       # linear (fast)
curl "http://localhost:8001/predict/005930?model=lstm"          # LSTM
curl "http://localhost:8001/predict/005930?model=transformer"   # Transformer
curl -X POST "http://localhost:8001/predict/005930/train?arch=transformer"  # pretrain → checkpoint
curl -X POST http://localhost:8001/predict/retrain -H 'content-type: application/json' \
  -d '{"tickers":["005930","000660"],"arch":"lstm","max_age_hours":24}'      # scheduled retrain (stale only)

curl -X POST http://localhost:8001/screener/ -H 'content-type: application/json' \
  -d '{"market":"KRX","rsi_max":30,"limit":10}'

# F5 multi-strategy backtesting (sma_cross | rsi_threshold | macd_cross | qlearn)
curl http://localhost:8001/backtest/strategies
curl -X POST http://localhost:8001/backtest/ -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"strategy":"rsi_threshold","params":{"rsi_buy_below":30,"rsi_sell_above":70}}'

# F5 reinforcement learning — Q-learning (tabular) / DQN (neural net)
curl -X POST http://localhost:8001/backtest/rl  -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":50}'
curl -X POST http://localhost:8001/backtest/dqn -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":30}'   # Rainbow-grade DQN (Double·Dueling·PER·n-step·Noisy)
curl -X POST http://localhost:8001/backtest/c51 -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # Distributional C51
curl -X POST "http://localhost:8001/backtest/qrdqn?mode=fqf&cvar_alpha=0.25&fqf_state_dependent=true" \
  -H 'content-type: application/json' -d '{"ticker":"005930","days":365,"episodes":15}'  # QR/IQN/FQF + CVaR
curl -X POST "http://localhost:8001/backtest/dpg?mode=ppo&n_rollouts=4&parallel=true&executor=process" -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # DPG (PPO·minibatch·KL) + multiprocess (state_dict replication) parallel rollouts
curl -X POST "http://localhost:8001/backtest/dpg?mode=a2c&n_rollouts=4&parallel=true&executor=persistent" -H 'content-type: application/json' \
  -d '{"ticker":"005930","days":365,"episodes":20}'   # persistent worker pool (reused) + shared-memory (SharedMemory) tensors
# {"executor":"persistent",...} — px/rsi loaded once, pool reused. Identical result to process·sequential (deterministic)
# Persistent pool (MPM): worker count via BACKTEST_PERSIST_WORKERS env, BrokenProcessPool auto-recreate, persistent_pool_stats()
```

> RL parallel-rollout `executor`: `thread` (shared model) · `process` (pool created per episode, state_dict replication) · `persistent` (reused pool + `SharedMemory` zero-copy px/rsi mapping — removes pool-recreation cost). All three give identical results to sequential via per-rollout seeds.

> Macro channel: `MACRO_INDICES` multi-indicator + `MACRO_COMBINE` 17 modes (…·erc_lw·erc_cc·erc_oas·erc_nlw·erc_quest·erc_quest_grid·**erc_quest_adaptive** (quantile-node adaptive-grid QuEST)·**erc_factor** (keep eigenvalues above MP edge λ⁺ as signal·flatten bulk = RMT denoising)·pca·ipca·ccipca). Diagnostic: `marchenko_pastur_gof(eigs, c)` = KS distance of sample eigenvalues vs MP law (signal detection). News sentiment uses FinBERT (`FINBERT_MODEL`=`ProsusAI/finbert` or KR `snunlp/KR-FinBert-SC`) when `FINBERT_ENABLED=true`, else keyword. Neutral fallback on source/model failure.

### F3 rag / agents
```bash
curl -X POST http://localhost:8002/rag/ingest -H 'content-type: application/json' \
  -d '{"documents":[{"id":"fed1","content":"Fed held rates at 5.5%","meta":{}}]}'
curl -X POST http://localhost:8002/rag/query -H 'content-type: application/json' \
  -d '{"query":"fed interest rates","k":3}'
# grounded:false when no evidence (hallucination block)

curl -X POST http://localhost:8004/agents/analyze -H 'content-type: application/json' \
  -d '{"ticker":"005930","persona":"swing"}'

# F3.3 self-correction — drift verdict + conservative correction from history+candidate
curl -X POST http://localhost:8004/agents/self_correct -H 'content-type: application/json' \
  -d '{"persona":"scalper","history":[{"signal":"BUY","confidence":0.8,"weight":0.1}],
       "candidate":{"signal":"BUY","confidence":0.8,"weight":0.5}}'
# {"drift":{"drift":true,"reasons":["weight_breach(...)"],...},
#  "corrected":{"signal":"BUY","weight":0.1,"corrected":true,"corrections":["weight_clamped_to_0.1"]}}
# churn (frequent BUY↔SELL)·low-confidence → corrected.signal="HOLD" (downgrade)

# F6.3 alerts (unconfigured channels → false / no-op)
curl -X POST http://localhost:8004/notify/ -H 'content-type: application/json' \
  -d '{"event":"STOP_LOSS","payload":{"ticker":"005930","price":68600}}'

# F6.3 two-way control — inbound commands (secret auth required; 403 rejects all if CONTROL_SECRET unset)
curl -X POST http://localhost:8004/control/command -H 'content-type: application/json' \
  -d '{"secret":"<control-secret>","text":"/stop"}'        # emergency bot halt
# {"command":"/stop","result":{"halted":true}}
curl -X POST http://localhost:8004/control/command -H 'content-type: application/json' \
  -d '{"secret":"<control-secret>","text":"/liquidate","prices":{"005930":71000}}'  # emergency liquidate
# {"command":"/liquidate","result":{"liquidated":1,"realized_pnl":..,"halted":true}}
# /resume · /status. Telegram webhook: POST /control/telegram?secret=... (or X-Telegram-Bot-Api-Secret-Token header)
```

### F4 risk-engine + paper trading
```bash
curl -X POST http://localhost:3001/risk/check -H 'content-type: application/json' \
  -d '{"ticker":"005930","entry_price":70000,"current_price":68600,
       "stop_loss_pct":0.02,"daily_loss_limit_pct":0.05,"max_position_pct":0.10}'
# {"action":"force_sell","triggered":["stop_loss"],...}

# Simulated (paper) fill — NOT real trading. Multi-ticker·slippage·fees·append-only ledger
# DATABASE_URL=postgres → paper_fills persistence + restart hydration
# client_order_id = idempotency key (optional). Same key on retry fills once only (ledger+DB dedup, COMPLIANCE §4.1)
curl -X POST http://localhost:3001/paper/execute -H 'content-type: application/json' \
  -d '{"ticker":"005930","side":"buy","quantity":10,"price":70000,"client_order_id":"ord-20260607-001"}'
# Retry (same client_order_id) → {"accepted":true,"reason":"중복 주문(멱등키) — 기존 체결 반환",...} (no re-fill)
curl http://localhost:3001/paper/portfolio
# {"positions":[...],"realized_pnl":..,"realized_by_ticker":{...},"fills":N}

# Multi-account — ?account= for isolated ledgers (unset=default). DB persistence: default only; named accounts in-memory.
curl -X POST "http://localhost:3001/paper/execute?account=strat-A" -H 'content-type: application/json' \
  -d '{"ticker":"005930","side":"buy","quantity":10,"price":70000}'
curl "http://localhost:3001/paper/portfolio?account=strat-A"   # {"account":"strat-A","positions":[...],...}
curl http://localhost:3001/paper/accounts                       # {"accounts":["default","strat-A"]}

# mark-to-market — current prices → per-ticker unrealized + equity-curve point
curl -X POST http://localhost:3001/paper/mark -H 'content-type: application/json' \
  -d '{"005930":75000,"000660":115000}'
curl http://localhost:3001/paper/equity_curve              # raw curve (DB-persisted if DATABASE_URL)
curl "http://localhost:3001/paper/equity_agg?period=daily" # daily|weekly|monthly|quarterly OHLC
curl -X POST http://localhost:3001/paper/alpha -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[2400,2450,2500]}'  # benchmark alpha
curl -X POST http://localhost:3001/paper/risk_metrics -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[2400,2440,2420,2480]}'  # beta·info-ratio·tracking-error
curl -X POST http://localhost:3001/paper/risk_rolling -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"benchmark":[...],"window":20}'      # rolling-window metrics
curl -X POST http://localhost:3001/paper/factor_regression -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[..mkt..],[..smb..],[..hml..]]}'  # Fama-French OLS
curl -X POST http://localhost:3001/paper/factor_regression_nw -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml],[rmw],[cma]],"lag":4}'  # 5-factor + Newey-West HAC SE
curl -X POST http://localhost:3001/paper/factor_regression_nw_auto -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]]}'  # Andrews auto-bandwidth → lag_auto
curl -X POST http://localhost:3001/paper/factor_regression_qs -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"prewhiten":true,"full_var":true}'  # QS + full VAR(1)
curl -X POST http://localhost:3001/paper/factor_regression_qs_aic -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"max_order":5}'  # AIC diagonal AR(p)
curl -X POST http://localhost:3001/paper/factor_regression_qs_var -H 'content-type: application/json' \
  -d '{"initial_capital":10000000,"factors":[[mkt],[smb],[hml]],"max_order":3,"criterion":"bic","stabilize":true,"companion":true}'  # full VAR(p)·BIC/HQ + companion projection

# F6.3 emergency control (risk-engine direct) — endpoints the agents /control delegates to
curl -X POST http://localhost:3001/control/halt -H 'content-type: application/json' -d '{"halted":true}'
curl http://localhost:3001/control/status        # {"halted":true,"open_positions":N}
# Per-account control: ?account=strat-A (halt·status·liquidate are account-independent)
# halt=true blocks new /paper/execute orders. Liquidation is halt-independent (Fail-Safe).
curl -X POST http://localhost:3001/control/liquidate -H 'content-type: application/json' \
  -d '{"prices":{"005930":71000,"000660":121000}}'  # market-sell all positions + auto-halt
# {"liquidated":2,"fills":[...],"realized_pnl":..,"halted":true}  (liquidation fills kept in append-only ledger)
```

### F1.5 KRX OPEN API
```bash
curl http://localhost:8003/krx/status
# {"configured":false,"note":"Set KRX_OPEN_API_KEY env var to activate."}

curl "http://localhost:8003/krx/ohlcv/005930?from_date=20260101&to_date=20260131&market=KOSPI"
# key not set: {"ticker":"005930","configured":false,"bars":[],"count":0}
# key set: {"bars":[{"date":"2026-01-01","open":70000,"high":71000,...,"source":"krx_openapi"}],...}

curl "http://localhost:8003/krx/investor-flow/005930"
# key not set: {"ticker":"005930","configured":false,"phase":"A_pending","flows":[],"count":0}
# key set: {"flows":[{"date":"..","institution":125000,"foreign":-48000,"individual":-77000}],...}
```
> 2-step KRX OPEN API call: OTP (`GenerateOTP.jspx`) → data (`jsonSvr.do`). Empty result when key not set; FinanceDataReader fallback stays active. API IDs: KOSPI=`stk_bydd_trd` / KOSDAQ=`ksq_bydd_trd` / investor=`stk_invsr_trd_by_isu`. Min 0.5s between calls (`KRX_API_RATE_LIMIT`).

### F1.2 broker tick feed (WebSocket)
```
ws://localhost:8003/market/feed/005930
# If BROKER_WS_URL set: BROKER_PROTOCOL=generic|kis, auth (BROKER_API_KEY/SECRET) +
# heartbeat ping-pong (BROKER_HEARTBEAT_INTERVAL/TIMEOUT) + backoff reconnect (BROKER_MAX_RETRIES, -1=inf).
# Else simulated.
ws://localhost:8003/market/feed_multi/005930,000660   # multi-ticker multiplexing (single WS)
```
> **Adaptive flow control (integrated)**: `SubscriptionManager` opt-in — with `aimd=AIMDRateController(...)` the global token-bucket rate auto-adjusts via AIMD (ack success = additive increase / subscription failure = multiplicative decrease). With `command_capacity`/`command_watermark`, pending commands are managed by a priority queue (unsubscribe prioritized, lowest-priority dropped on overflow, `command_backpressured()` signal). Unset → legacy FIFO·fixed rate (backward compatible). Pure flow-control units: [adaptive_flow.py](services/ingest/app/services/adaptive_flow.py).

### F6.2 BFF aggregation + real-time candles
```bash
curl "http://localhost:3002/api/dashboard/005930?persona=swing"

curl "http://localhost:3002/api/candles/005930?days=30"   # candles (OHLCV) — ingest proxy (days clamped 1~365)
# {"ticker":"005930","bars":[{"date":..,"open":..,"high":..,"low":..,"close":..,"volume":..}],"count":30}
```
> The dashboard candle chart (`components/CandleChart.tsx`) loads initial bars from `/api/candles` and polls `/api/price` every 5s to update the forming candle's close/high/low in real time (direct SVG render, no charting library). Geometry is isolated in pure functions in [lib/candles.ts](web/apps/dashboard/lib/candles.ts) (tested).

## Testing

```bash
make test-py      # pytest (4 Python services)
make test-rust    # cargo test (risk-engine + tui)
make test-web     # vitest (bff + dashboard)

# individual
cd services/ingest && uv run pytest tests/ -v
export PATH=$HOME/.cargo/bin:$PATH && cargo test -p risk-engine
cd web && pnpm -r test
```

**Current passing tests: 529 (Python 350 + Rust 90 + Web 78 + tools/mpm 17, incl. pgvector integration 4 + FinBERT real-model 1) + postgres integration 1 (ignored, needs DB)** — [test/impl/34/result.md](test/impl/34/result.md)
> iter-25: bff `@types/node` (fixes `process` TS2580 → BFF starts·dashboard connects) + MPM background manager (`make mpm`/`mpm-stop`/`mpm-status`/`mpm-logs`, tools/mpm +5). E2E: 7 services start·clean shutdown verified.
> iter-24: MPM upgrade — tools/mpm Procfile generator (ENV·groups, +12) + RL persistent-pool stats·env-workers·resilience (analysis +3).
> iter-23: F5 paper-trading multi-account — per-account isolated ledger (risk-engine +5, backward-compatible·default-account DB persistence).
> iter-22: F2.2 upgrade — adaptive-grid QuEST·MP goodness-of-fit·factor-model target (analysis +9, additive·no-regression).
> iter-21: F1.2 flow control (AIMD·priority queue·backpressure) integrated into `SubscriptionManager` token bucket (ingest +8, opt-in·backward-compatible).
> iter-20 (6 next-step items): MPM-RL persistent pool+shared memory (analysis +3) · F3.3 self-correction (agents +15) · F6.3 two-way control (agents +12, risk-engine +6) · F1.2 AIMD·priority queue·backpressure (ingest +14) · F6.2 real-time candles (web +15) · MPM-dev honcho `make dev-all`.
> Post-review security fixes (iter-19 review):
> - **risk-engine**: (1) `/paper/execute` idempotency key (client_order_id) + DB partial UNIQUE·ON CONFLICT, (2) `with_book` Mutex poison recovery, (3) BOOK/DB atomicity — `prepare` (compute) → DB persist → `commit` two-phase DB-first durability (insert failure → ledger untouched + 5xx). Tests 52→62 + postgres integration 1 (`make up` + `TEST_DATABASE_URL=... cargo test -- --ignored`, passed against real postgres).
> - **analysis**: (4) torch training endpoints (dqn/c51/qrdqn/dpg·predict·train·retrain) offloaded to a separate process ([app/core/offload.py](services/analysis/app/core/offload.py)) — event loop non-blocking + torch isolation. `ANALYSIS_INPROC_TRAIN=1` (test/local) runs in-process. (5) LSTM multivariate channel providers now receive the real ticker (fixes the `df.index.name` placeholder bug).
> - **bff**: (6) ticker validation·encoding ([ticker.util.ts](web/apps/bff/src/ticker.util.ts), `^[A-Za-z0-9]{1,20}$` + encodeURIComponent) — blocks path injection. Web tests 8→11.

> pgvector integration tests (4) run when postgres is up (`make up`); auto-skip otherwise.
> Paper-trading DB persistence·hydration: see integration verification in impl/4 result.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `make up` YAML parse error | `:-` in `env_file: [.env.${ENV:-dev}]` | quote value `[".env.${ENV:-dev}"]` (fixed) |
| `cargo: command not found` | PATH not set | `export PATH=$HOME/.cargo/bin:$PATH` |
| `Cannot connect to Docker daemon` | Docker Desktop not running | `open -a Docker`, wait ~30s |
| `finance-datareader not found` | PyPI package name | `finance-datareader` (hyphen) |
| `Cannot switch to pnpm@9` | invalid version pin | `pnpm@9.15.0` (fixed) |
| pytest mock contamination | shared DataFrame in-place mutation | `df.rename(columns=str.lower)` (non-destructive) |
| bff `Cannot find name 'process'` (TS2580) | `@types/node` missing in bff | devDeps `@types/node` + tsconfig `types:["node"]` (fixed) |
| `pnpm install --offline` purges node_modules | floating ranges (`19.x`) re-resolve → transitive dep not in store | online `pnpm install` or `--frozen-lockfile`. avoid `--offline` |
| port :3000 lingers after `make mpm-stop` | `next dev` workers escape the process group | stop = honcho graceful + group SIGTERM sweep (fixed) |

## Next Steps (PRD v2 Roadmap)

| Phase | Item | Detail |
|-------|------|--------|
| — | F5 RL | GAE norm-clip·ensemble (✅ persistent worker pool·shared-memory tensors — iter-20) |
| — | Paper trading | Phase-preserving Schur clipping (✅ multi-account — iter-23 / Schur clipping deferred: companion form not recoverable under similarity, see result/23) |
| — | Live trading | Broker real order execution (currently paper/simulated only, **real funds·outbound forbidden**) |
| Phase A | Data collection | ✅ A-1 KRX OPEN API client · ✅ A-2 daily batch scheduler+DB (iter-30) — A-3 full history load, A-4 KIS WebSocket live feed remaining |
| Phase B | Market alerts | ✅ B-1 KRX market alert collector (iter-31) · ✅ B-2 emergency liquidation trigger Rust (iter-32) · ✅ B-3 short-selling daily stats (iter-31) · ✅ B-4 short-sell overheating position reduction (iter-32) · ✅ B-5 TUI market alert banner (iter-32) · ✅ B-6 web dashboard live data (iter-32) |
| Phase C | Analysis | ✅ C-1 VWAP·close_pct (iter-33) · ✅ C-2 Breadth TRIN·ADLine (iter-33) · ✅ C-3 FlowAgent (iter-33) · ✅ C-4 AlertAgent override (iter-33) · ✅ C-5 80-ticker signal/close filter (iter-33) · ✅ C-6 max_short_ratio (iter-33) |
| Phase D | ESG · Reports | ✅ D-1 ESG proxy score (iter-34) · ✅ D-2 IR report RAG (iter-34) · ✅ D-3 intraday bars (iter-34) · ✅ D-4 intraday indicators (iter-34) · ✅ D-5 ESG widget (iter-34) · ✅ D-6 ESG screener (iter-34) |

> iter-63 done: ✅ F10.1 Sidebar service status — real-time health polling
> - **Root cause**: `StatusDot` hardcoded to `var(--color-up)` which is red (Korean stock convention) → always appeared red regardless of actual status
> - **BFF new endpoint**: `GET /api/services/health` — parallel health checks for ingest, analysis, agents, risk (2s timeout each)
> - **Sidebar polling**: 30s auto-refresh. Absolute colors independent of stock convention: UP=#3fb950 (green), DOWN=#f85149 (red), loading=#6e7681 (gray). Tooltip shows "정상" / "연결 불가" status
>
> iter-62 done: ✅ F5 Backtest page consolidation + API response mapping fix
> - **Backtest unified**: `/backtest` now has two tabs — Rule-based (SMA cross, RSI threshold, MACD cross, Q-learning) + RL (DQN, PPO, A2C, QR-DQN). Shared ticker input, auto-run on mount (rule-based), trade history expandable
> - **API mapping fix**: analysis service returns flat response with `total_return_pct` (already ×100) and `num_trades` — now correctly mapped to UI fields `total_return` (÷100) and `total_trades`. Fixes blank results on backtest execution
> - **Strategy/screener simplified**: removed duplicate backtest tab → replaced with "↺ Backtest →" banner linking to `/backtest`. Page is now screener-only
>
> iter-61 done: ✅ F9.4 Strategy/screener page full overhaul + row-click bug fix
> - **Screener tab — expanded filters**: RSI min/max, minimum volume, close price range (min/max) now exposed in UI (backend already supported)
> - **Strategy backtest tab (new)**: Rule-based (SMA cross, RSI threshold, MACD cross, Q-learning) + RL (DQN, PPO, A2C, QR-DQN) with ticker / days / episodes inputs. Result cards: total return, annualized return, Sharpe, max drawdown, win rate, trade count
> - **BFF new route**: `POST /api/backtest/rl` — dispatches to `/backtest/dqn`, `/backtest/dpg?mode=ppo|a2c`, `/backtest/qrdqn` based on `algo` field
> - **Row-click bug fix**: `navigateToTicker` now sets both cookie (`st_ticker`) and `localStorage` (`st_ticker`/`st_name`) → TopBar updates immediately on reload. Uses `window.location.assign('/')`
>
> iter-60 done: ✅ F9.3 Portfolio & strategy/screener row click → dashboard navigation — clicking any holdings row or screener result row sets `st_ticker` cookie and navigates to `/` (dashboard) for immediate buy/sell. cursor: pointer + tooltip on hover. TS clean.
>
> iter-59 done: ✅ F8.11 bugfix — restart persistence hardened: `tokio::spawn` async save → synchronous call (completes before SIGINT). SIGINT/SIGTERM graceful shutdown hook added (saves final snapshot on exit). Atomic file write (`.tmp` → rename, prevents corruption). Rust 81/81 PASS.
>
> iter-58 done: ✅ F8.12 Portfolio cash display consistency — MyPage cash input initializes from `portfolio.cash` (live risk-engine remaining) instead of stale `user.initial_cash` (auth DB configured value). Labels clarified: "잔여예수금" (remaining cash), "총 자산(예수금+평가)" (total assets = cash + position market value). TS clean.
>
> iter-57 done: ✅ F8.11 Paper trading restart persistence — `data/paper_book.json` JSON snapshot. Without postgres, saves on every fill/cash change; restores positions, cash, realized P&L on restart. `PaperBookSnapshot` Serde serialization. Rust 81/81 PASS.
>
> iter-56 done: ✅ F7.10 Buy fee included in cost basis — `cost_basis += fill_price×qty + fee`, `avg_price = (prev_cost + fill_price×qty + fee) / new_qty`. Immediate buy→sell shows fee loss (buy fee + sell fee) in P&L. Rust 81/81 PASS.
>
> iter-55 done: ✅ F6.3 Korean stock market color convention — up(+)=red, down(−)=blue. `globals.css` `--color-up: #f85149`, `--color-down: #388bfd` (dark); `#cf222e`/`#0969da` (light). Portfolio legend updated. MiniCandleChart hardcoded colors updated. TS clean.
>
> iter-54 done: ✅ F7.9 Portfolio improvements — column "평균단가"→"매수시단가" (verification clarity). Footer row added (총 매수금액 · 총 매도금액 · 총 평가손익 · 수익률 · 100%). Paper trading slippage removed (`SLIPPAGE_BPS=0.0`) — fills at screen price. Rust 81/81 PASS, TS clean.
>
> iter-53 done: ✅ F7.8 SimulationPanel reset on ticker change — `useEffect([ticker])` resets qty→1, fill result→null, error→''. Switching tickers via TopBar search immediately clears prior trade state. TS clean.
>
> iter-52 done: ✅ F7.5 final layout — SimulationPanel 2 rows: row1=`(현재주가) X원 · 수량 [input] · = Y원` (Y turns red+bold when total > cash), row2=`cash balance (9px)` + `[▲Buy][▼Sell]` right-aligned. TS clean.
>
> iter-51 done: ✅ F7.5 final layout — SimulationPanel single row: `(현재주가) X원  수량 [input]  = Y원  [▲Buy] [▼Sell]`. Cash balance shown below in smaller font (9px). TS clean.
>
> iter-50 done: ✅ F7.5 final layout — SimulationPanel 2-column layout. Left: 3 rows (current price · qty number input · = amount). Right: ▲Buy/▼Sell buttons vertically stacked. Cash balance shown below 3 rows. Removed "매수/매도가격" label, simplified to "= result". TS clean.
>
> iter-49 done: ✅ F7.4 qty input restored to `type="number"` — uses browser-native spinner (up/down arrows). Removed custom `▼`/`▲` buttons. Same UX as ESG/short-ratio filter inputs. TS clean.
>
> iter-48 done: ✅ F7.4 redesign — SimulationPanel 3-row vertical layout (current price · qty · buy/sell amount). Qty step buttons `−`/`＋` → `▼`/`▲` arrows. Buy/sell action buttons in separate bottom row. TS clean.
>
> iter-47 done: ✅ F7.4 patch — SimulationPanel qty `−`/`＋` step buttons added (`stepQty(±1)`, min 0). Preserves `type="text"` select-all UX while restoring manual increment/decrement. TS clean.
>
> iter-46 done: ✅ F6.2.13 extended — Sidebar sub-page menu links: removed `?ticker=...&persona=...` query string entirely. Menu `<Link href={item.href}>` uses plain path. Persona selector converted from `<Link>` to `<button onClick={handlePersonaChange}>` (sets `st_persona` cookie + `router.push('/')`). `useSearchParams` removed; `useEffect` reads cookie for active persona highlight. No URL params shown on portfolio/strategy/risk/backtest/agents pages. TS clean.
>
> iter-45 done: ✅ F6.2.13 URL parameter hiding — ticker/persona passed via cookie (`st_ticker`/`st_persona`, 30-day) instead of query string. TopBar `navigate()` sets `document.cookie` then `router.push('/')`. `app/page.tsx` reads from `next/headers cookies()` (searchParams prop removed). Address bar always shows `/` (except `/login`, `/register`). TS clean.
>
> iter-44 done: ✅ F7.7 Portfolio buy_amount = purchase price × qty — Rust `Position.cost_basis: f64` added (buy: `+= fill_price × qty`, sell: proportional reduction, full-close: 0). Portfolio `buy_amount` column uses `cost_basis` first (fallback: `avg_price × qty`). Legend updated to "매수시단가×수량". Rust cargo check clean.
>
> iter-43 done: ✅ F7.6 Cash sync bug fix — `change-cash/route.ts` fire-and-forget → `await` (try/catch), eliminating race condition. `ClientLayout` now uses `getToken()` (dual-store: localStorage + sessionStorage). TS clean.
>
> iter-42 done: ✅ F8.10 Login "Remember ID" + "Auto Login" — `storeSession(autologin)` routes to localStorage (persistent) or sessionStorage (tab-scoped). `getToken()`/`getStoredUser()` check localStorage first, sessionStorage fallback. Login page: 2 checkboxes (Remember ID, Auto Login) + `CheckOption` sub-component. TS clean.
>
> iter-41 done: ✅ Cash sync — Rust `POST /paper/set-cash` new endpoint + BFF `/api/paper/set-cash` proxy + Next.js `change-cash` API syncs risk-engine cash (fire-and-forget). MyPage cash change: fetches current total-buy-amount, auto-floors input to total-buy-amount if below.
>
> iter-40 done: ✅ TopBar per-user ticker search history (localStorage `st_ticker_history_{userId}`, dropdown on empty-focus, max 10 entries, per-item/clear-all delete) · SimulationPanel qty input UX (type=text select-all, qty=0 alert, insufficient-cash pre-check alert) · SimulationPanel inline layout (qty + amount + buttons in 1 row, buttons 50% smaller, bottom panel height alignment).
>
> iter-39 done: ✅ DB persistence (better-sqlite3 → node:sqlite Node 24 built-in, ABI mismatch resolved, globalThis.__authDb HMR singleton) · `make db-reset` command · portfolio daily candle mini-chart carousel (MiniCandleChart SVG per position, left/right arrow scroll) · portfolio total-buy-amount · total-sell-amount columns + legend · strategy/risk/backtest/agents pages: module-level state persistence (re-query only on ticker change).
>
> iter-38 done: ✅ F8 User Auth — register (/register: email · name · password · deposit default ₩100M · TOTP QR confirm) · login (/login: bcryptjs · jose JWT 7d · TOTP 2FA) · AuthGuard ClientLayout (blocks unauthenticated access → redirect /login) · Sidebar user name click → MyPage roll-up panel (change password · deposit · TOTP enroll) · logout · 7 API Route Handlers (register/login/me/change-password/change-cash/totp/qr/totp/enable) · SQLite (better-sqlite3 auth.db) · backtest qlearn 500 error fixed (auto-delegate to rl_backtest_ticker) · Rust INITIAL_CASH ₩10M → ₩100M · TS clean.
>
> iter-37 done: ✅ F6.2.11 enhancements — Q1 shows last trading session after market close · mouse-wheel zoom · price tooltip · Y-axis ticks · Q2 hourly return fixed (cumulative return vs day-open, intraday fallback linear interpolation) · Q2/Q3 Y-axis scale zoom (scroll) · X/Y axes on all quadrants · ⛶ expand modal popup (ESC to close) · QUAD_H=330 (total 660px, restores ESG alignment) · TS clean.
>
> iter-36 done: ✅ F6.2.11 4-quadrant candle chart (CandleChart4: Q1 today 5m real-time line / Q2 hourly avg-return bars / Q3 weekday avg-return bars / Q4 existing daily candles) · F7.3 SIMULATION virtual cash tracking (initial ₩10M, deduct on buy / add on sell — Rust PaperBook.cash) · portfolio BFF enrichment (current price · name · P&L · weight via parallel fetch) · backtest/agents sub-pages auto-query on mount · Makefile local-dev/local-staging shortcuts · TS all files clean.
>
> iter-35 done: ✅ F7 simulation buy/sell — dashboard buy▲/sell▼ panel (SimulationPanel, BFF POST /api/paper/execute) · portfolio reflection · F6.2.9 TopBar ticker+name display (localStorage st_ticker/st_name persistence, BFF dynamic lookup for unlisted tickers, mounted-flag SSR hydration fix) · F6.2.10 risk/backtest/agents sub-pages inherit dashboard ticker context + show company name · TS all files clean.
> iter-34 done: ✅ Phase D complete — D-1 ESG proxy score API (E/S/G 3 sub-scores, 6h cache) · D-2 Korea IR council AI report RAG (POST/GET /rag/ir-report, vector store) · D-3 intraday bars (FDR + daily downsampling fallback, 1m/5m) · D-4 intraday indicators (RSI/MACD/VWAP per bar) · D-5 dashboard ESG widget (E/S/G bar chart, main page) · D-6 screener min_esg_score filter · 5 sub-pages connected to real APIs (strategy screener / agents pipeline / backtest form / risk monitor / portfolio ledger) · BFF portfolio+rag/ir-report routes added · ingest 168·analysis 137·agents 39·rag 6 PASS · TS type check PASS all pages.
> iter-33 done: ✅ Phase C complete — C-1 VWAP(20)·close_pct (analysis) · C-2 Breadth API TRIN·ADLine · C-3 FlowAgent institutional+foreign 3-day net · C-4 AlertAgent override (danger→SELL, warning→HOLD) · C-5 80-ticker signal/close screener · C-6 max_short_ratio filter · 6-agent pipeline · dashboard VWAP/Close% panel · shortSell.rows undefined fix · bottom panels repositioned under chart · total 520→529.
> iter-32 done: ✅ Phase B-2 emergency liquidation trigger (market_alert_level≥3→ForceSell, =2→BlockBuy, /risk/alert-check) · ✅ B-4 short-sell excess position reduction (short_ratio_limit→ReducePosition) · ✅ B-5 TUI market alert banner (AlertItem, 4-row layout, color coding) · ✅ B-6 web dashboard live data (level badges, short-sell ratio table, graceful fallback) · MACD [object Object] bug fixed (indicators type redefinition) · Rust 72→81, total 511→520.
> iter-31 done: ✅ Phase B-1 KRX market-alert collector (KIND POST scraper, MarketAlertDaily, /krx/market-alerts) · ✅ Phase B-3 short-selling daily stats (ShortSellingDaily, /krx/short-selling) · ✅ dynamic stock DB (FDR full listing 24h cache, /krx/stocks/search, BFF proxy, TopBar BFF dynamic search) · ✅ KOSPI/KOSDAQ dynamic market badge · ingest 144→168, total 487→511.
> iter-30 done: ✅ Phase A-2 daily batch scheduler + DB schema (APScheduler 15:40 KST · OhlcvDaily · InvestorFlowDaily · upsert · /scheduler/status/run) · ingest 128→144, total 471→487.
> iter-29 done: ✅ Tooltip bottom-clipping guard (ref height measurement + upward flip) · ✅ Company-name/code unified search autocomplete (lib/stocks.ts 165 stocks · searchStocks, TopBar dropdown with keyboard nav) · ✅ Candle chart upgrade (X/Y axes · responsive ResizeObserver · scroll zoom · nice price intervals · padded range) · Web tests 50→68.
> iter-28 done: ✅ 40-item inline tooltip system across all dashboard UI — Tooltip component (position:fixed · 260ms delay · viewport flip) + TOOLTIPS dictionary (persona×4 · menu×6 · service×4 · indicator×6 · MetricCard×5 · panel×7 · risk×3 · flow×3 · badge×2) · Web tests 32→50.
> iter-27 done: ✅ Candle tooltip fix (position:fixed + viewport coords — overflow/stacking resolved) · ✅ F1.5 KRX OPEN API collector (KrxOpenApiService, /krx/ohlcv, /krx/investor-flow, /krx/status) · ingest +23 tests (total 128). Python 282→305.
> iter-26 done: ✅ Phase 0 — dark/light theme toggle (ThemeProvider·localStorage) · candle chart mouse-over tooltip (OHLCV·change%·flip) · clock 1s tick · 5 sub-pages (portfolio/strategy/risk/backtest/agents) 404 resolved · 2 TS errors fixed. Web tests 26→32 (+6 findCandleIndex). PRD v2 F6.2 updated.
> iter-25 done: bff `@types/node` + MPM background manager (`make mpm`/`mpm-stop`/`mpm-status`/`mpm-logs`, +5). E2E: 7 services start·clean shutdown verified.
> iter-23 done: ✅ F5 paper-trading multi-account — `?account=` isolated ledger·per-account halt/liquidate·`GET /paper/accounts` (default account DB-persisted).
> iter-22 done: ✅ F2.2 upgrade — adaptive-grid QuEST (`erc_quest_adaptive`)·MP goodness-of-fit (`marchenko_pastur_gof`)·factor-model target (`erc_factor`).
> iter-21 done: ✅ F1.2 flow control integrated into `SubscriptionManager` token bucket (AIMD rate·priority command queue·backpressure, opt-in·backward-compatible).
> iter-20 done (next steps): ✅ F3.3 self-correction · ✅ F6.2 real-time candles · ✅ F6.3 two-way control · ✅ F1.2 AIMD·priority queue·backpressure · ✅ MPM-RL persistent pool+shared memory · ✅ MPM-dev (`make dev-all`).
