#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.yaml"
ZEROCLAW_CONFIG="$HOME/.zeroclaw/config.toml"
PASTEGUARD_URL="http://localhost:3000"

is_running() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --status running --quiet 2>/dev/null | grep -q .
}

healthcheck() {
  local retries=15
  echo -n "헬스체크 대기 중"
  for ((i = 0; i < retries; i++)); do
    if curl -sf "$PASTEGUARD_URL/health" > /dev/null 2>&1; then
      echo " 완료"
      return 0
    fi
    echo -n "."
    sleep 2
  done
  echo " 실패 (타임아웃)"
  return 1
}

patch_zeroclaw() {
  [[ ! -f "$ZEROCLAW_CONFIG" ]] && return

  if grep -q "anthropic-custom:$PASTEGUARD_URL" "$ZEROCLAW_CONFIG"; then
    echo "Zeroclaw: 이미 PasteGuard로 설정되어 있음"
    return
  fi

  sed -i "s|default_provider = \"anthropic\"|default_provider = \"anthropic-custom:$PASTEGUARD_URL/anthropic\"|" "$ZEROCLAW_CONFIG"

  if grep -q "anthropic-custom:$PASTEGUARD_URL" "$ZEROCLAW_CONFIG"; then
    echo "Zeroclaw: default_provider → anthropic-custom:$PASTEGUARD_URL/anthropic"
  else
    echo "Zeroclaw: default_provider가 'anthropic'이 아니라 패치 생략 (수동 설정 필요)"
  fi
}

restore_zeroclaw() {
  [[ ! -f "$ZEROCLAW_CONFIG" ]] && return

  if grep -q "anthropic-custom:$PASTEGUARD_URL" "$ZEROCLAW_CONFIG"; then
    sed -i "s|default_provider = \"anthropic-custom:$PASTEGUARD_URL/anthropic\"|default_provider = \"anthropic\"|" "$ZEROCLAW_CONFIG"
    echo "Zeroclaw: default_provider → anthropic (복원)"
  fi
}

start() {
  if is_running; then
    echo "PasteGuard 이미 실행 중 ($PASTEGUARD_URL)"
    exit 0
  fi

  if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "config.yaml 없음 → config.example.yaml 복사"
    cp "$SCRIPT_DIR/config.example.yaml" "$CONFIG_FILE"
  fi

  mkdir -p "$SCRIPT_DIR/data"
  chmod 777 "$SCRIPT_DIR/data"

  docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

  if healthcheck; then
    echo "PasteGuard 실행됨 ($PASTEGUARD_URL)"
    patch_zeroclaw
  else
    echo "PasteGuard 시작 실패. 로그 확인: $0 logs"
    exit 1
  fi
}

stop() {
  restore_zeroclaw
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" down
  echo "PasteGuard 종료됨"
}

logs() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs -f pasteguard
}

status() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  logs)    logs ;;
  status)  status ;;
  *)
    echo "사용법: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
