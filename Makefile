# stock-trader — 루트 Makefile (Python + Rust + Node 통합)
.PHONY: up up-app down dev-analysis dev-rag dev-ingest dev-agents dev-risk dev-tui dev-web \
        local-all local-dev local-staging local-stop local-logs local-status \
        dev-all mpm mpm-stop mpm-status mpm-logs mpm-check sync db-reset test-py test-rust test-web test build deploy

# 환경 선택: make <target> ENV=local|dev|staging|prod  (기본 local)
ENV ?= local
MPM_DIR := .mpm

# ── 인프라 (postgres+pgvector, redis) ───────────────────────────────────────────
# ENV 를 compose 로 전달 → env_file 가 .env.$(ENV) 선택. local 도 동일 인프라 사용.
up:
	ENV=$(ENV) docker compose up -d
# 전체 앱 스택(app 프로파일)까지 컨테이너로 기동
up-app:
	ENV=$(ENV) docker compose --profile app up -d
down:
	ENV=$(ENV) docker compose --profile app down --remove-orphans

# ── 의존성 일괄 동기화 ───────────────────────────────────────────────────────────
sync:
	cd services/analysis && uv sync --dev
	cd services/rag      && uv sync --dev
	cd services/ingest   && uv sync --dev
	cd services/agents   && uv sync --dev
	cd web && pnpm install

# ── 인증 DB 초기화 (사용자 데이터 전체 삭제) ──────────────────────────────────────
# ⚠  이 명령은 모든 가입 사용자 데이터를 영구 삭제합니다. 복구 불가.
# 대시보드 auth는 모든 환경에서 SQLite(node:sqlite). PostgreSQL은 분석 서비스 전용.
# - ENV=local : 로컬 파일 삭제
# - ENV=dev|staging|prod : Docker 볼륨(dashboard-data) 삭제
db-reset:
ifeq ($(ENV),local)
	rm -f web/apps/dashboard/data/auth.db
	@echo "auth.db 삭제 완료 (local·SQLite) — 다음 기동 시 스키마 자동 재생성"
else
	@echo "⚠  auth DB 초기화 (ENV=$(ENV), Docker 볼륨)..."
	@docker volume rm stock-trader_dashboard-data 2>/dev/null \
	  && echo "dashboard-data 볼륨 삭제 완료 — auth.db 포함" \
	  || echo "볼륨 없음 (이미 삭제됨)"
	@echo "※ 분석 서비스 PostgreSQL 초기화: docker volume rm stock-trader_pgdata"
	@echo "재기동: make up-app ENV=$(ENV)"
endif

# ── Python 서비스 직접 실행 (직접실행 우선, .env.$(ENV) 자동 로드) ────────────────
# pydantic-settings 는 각 서비스 CWD 의 .env.local 을 읽음. ENV!=local 시 해당 파일 지정.
dev-analysis:
	cd services/analysis && APP_ENV=$(ENV) uv run uvicorn app.main:app --reload --port 8001
dev-rag:
	cd services/rag && APP_ENV=$(ENV) uv run uvicorn app.main:app --reload --port 8002
dev-ingest:
	cd services/ingest && APP_ENV=$(ENV) uv run uvicorn app.main:app --reload --port 8003
dev-agents:
	cd services/agents && APP_ENV=$(ENV) uv run uvicorn app.main:app --reload --port 8004

# ── Rust 서비스 직접 실행 (.env.$(ENV) 를 환경변수로 로드 후 실행) ────────────────
dev-risk:
	set -a; . ./.env.$(ENV); set +a; cd core/risk-engine && cargo run
dev-tui:
	set -a; . ./.env.$(ENV); set +a; cd apps/tui && cargo run

# ── Web (Next.js dashboard + NestJS BFF) ────────────────────────────────────────
dev-web:
	cd web && pnpm -r dev

# ── 로컬 전체 기동 (권장) ──────────────────────────────────────────────────────────
# 터미널 1개로 전 서비스(py×4 + rust×1 + web×1) 백그라운드 기동.
# ※ dev-all / mpm 과 동시에 실행하면 포트 충돌 → local-all 만 사용.
#   make local-all          # ENV=local (기본) — 전 서비스 백그라운드 기동 (기존 mpm 자동 중지 후 재시작)
#   make local-dev          # ENV=dev 고정 단축키
#   make local-staging      # ENV=staging 고정 단축키
#   make local-all ENV=prod # 임의 환경 지정
#   make local-stop         # 전 서비스 중지
#   make local-logs         # 실시간 로그
#   make local-status       # 프로세스 상태 확인
local-all: local-stop
	python3 tools/mpm/mpm.py up --env $(ENV) $(foreach g,$(GROUP),--group $(g))
local-dev: local-stop
	python3 tools/mpm/mpm.py up --env dev $(foreach g,$(GROUP),--group $(g))
local-staging: local-stop
	python3 tools/mpm/mpm.py up --env staging $(foreach g,$(GROUP),--group $(g))
local-stop:
	python3 tools/mpm/mpm.py stop 2>/dev/null || true
local-logs:
	tail -f $(MPM_DIR)/mpm.log
local-status:
	python3 tools/mpm/mpm.py status

# ── 포그라운드 전체 기동 (터미널 점유, 색상 로그) ────────────────────────────────────
# ※ local-all(백그라운드)과 동시에 실행 금지 — 포트 충돌.
#   make dev-all            # 전 서비스 포그라운드 (Ctrl-C 로 전체 종료)
dev-all:
	uvx --from honcho honcho -f Procfile.dev start

# ── MPM 저수준 명령 (local-all/local-stop 권장; 직접 조작 시 사용) ─────────────────
mpm:
	python3 tools/mpm/mpm.py up --env $(ENV) $(foreach g,$(GROUP),--group $(g))
mpm-stop:
	python3 tools/mpm/mpm.py stop
mpm-status:
	python3 tools/mpm/mpm.py status
mpm-logs:
	tail -f $(MPM_DIR)/mpm.log
mpm-check:
	python3 tools/mpm/mpm.py --check --env $(ENV) $(foreach g,$(GROUP),--group $(g))

# ── 시험 ────────────────────────────────────────────────────────────────────────
test-py:
	cd services/analysis && uv run pytest
	cd services/rag     && uv run pytest
	cd services/ingest  && uv run pytest
	cd services/agents  && uv run pytest
test-rust:
	cargo test --workspace
test-web:
	cd web && pnpm -r test
test: test-py test-rust test-web

# ── 컨테이너 빌드 (dev 이상) ─────────────────────────────────────────────────────
build:
	ENV=$(ENV) docker compose --profile app build

# ── 배포 ─────────────────────────────────────────────────────────────────────────
deploy:
	helm upgrade --install stock-trader ./deploy/helm
