#!/usr/bin/env bash
# Rust(cargo) 부트스트랩 — 플랫폼 자동 감지 후 미설치 시 rustup 으로 설치.
#
# 프로젝트의 Rust 서비스(core/risk-engine, apps/tui)는 cargo 가 필요하다.
# mpm 레지스트리(tools/mpm/mpm.py)가 `$HOME/.cargo/env` 를 소싱하므로
# 설치 경로도 rustup 기본값(~/.cargo)으로 통일한다.
#
# rustup 공식 설치기는 host triple(aarch64/x86_64 · macOS/Linux)을 스스로
# 감지하므로 arm/intel 분기를 수동으로 할 필요는 없다. 아래 감지는 로그용.
set -euo pipefail

# 1) 이미 설치돼 있으면(현재 PATH 또는 ~/.cargo) 종료.
if command -v cargo >/dev/null 2>&1; then
  echo "✓ cargo 발견: $(cargo --version)"
  exit 0
fi
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.cargo/env"
  if command -v cargo >/dev/null 2>&1; then
    echo "✓ cargo 발견(~/.cargo): $(cargo --version)"
    exit 0
  fi
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  echo "플랫폼: macOS Apple Silicon (aarch64-apple-darwin)";;
      x86_64) echo "플랫폼: macOS Intel (x86_64-apple-darwin)";;
      *)      echo "플랫폼: macOS ($ARCH)";;
    esac
    ;;
  Linux)
    echo "플랫폼: Linux ($ARCH)"
    ;;
  *)
    echo "✗ 지원하지 않는 플랫폼: $OS/$ARCH — https://rustup.rs 에서 수동 설치하세요." >&2
    exit 1
    ;;
esac

# 2) curl(없으면 wget)로 rustup 비대화식 설치. host triple 은 rustup 이 자동 감지.
echo "Rust(cargo) 미설치 — rustup 으로 설치를 시작합니다..."
if command -v curl >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile default
elif command -v wget >/dev/null 2>&1; then
  wget -qO- https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile default
else
  echo "✗ curl·wget 둘 다 없음 — 먼저 설치 후 재시도하세요." >&2
  exit 1
fi

# 3) 현재 셸 세션에 PATH 반영 후 확인.
# shellcheck disable=SC1091
. "$HOME/.cargo/env"
echo "✓ 설치 완료: $(cargo --version)"
echo "  (새 셸에서는 ~/.cargo/env 가 자동 로드됩니다. 현재 셸은 'source \$HOME/.cargo/env')"
