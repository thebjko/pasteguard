#!/usr/bin/env bash

PID_FILE="/tmp/pasteguard.pid"
LOG_FILE="/tmp/pasteguard.log"
PORT=3000

start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "이미 실행 중 (PID: $(cat "$PID_FILE"))"
    exit 1
  fi

  bun run dev >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "서버 시작 (PID: $(cat "$PID_FILE"), 로그: $LOG_FILE)"

  # 정상 기동 대기
  for i in $(seq 1 10); do
    sleep 1
    if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
      echo "준비 완료: http://localhost:$PORT"
      return
    fi
  done
  echo "경고: 10초 내 응답 없음. 로그 확인: tail -f $LOG_FILE"
}

stop() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      rm -f "$PID_FILE"
      echo "서버 종료 (PID: $pid)"
    else
      echo "프로세스 없음. PID 파일 삭제."
      rm -f "$PID_FILE"
    fi
  else
    # PID 파일 없으면 포트로 찾아서 종료
    local pid
    pid=$(lsof -ti:"$PORT" 2>/dev/null)
    if [ -n "$pid" ]; then
      kill "$pid"
      echo "서버 종료 (PID: $pid)"
    else
      echo "실행 중인 서버 없음"
    fi
  fi
}

status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "실행 중 (PID: $(cat "$PID_FILE"))"
    curl -sf "http://localhost:$PORT/health" | python3 -m json.tool 2>/dev/null || true
  else
    echo "중지됨"
  fi
}

case "$1" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  logs)    tail -f "$LOG_FILE" ;;
  *)
    echo "사용법: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
