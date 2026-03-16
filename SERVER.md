# 서버 실행 / 종료

## 빠른 시작

```bash
./server.sh start    # 서버 시작 (백그라운드)
./server.sh stop     # 서버 종료
./server.sh restart  # 재시작
./server.sh status   # 상태 확인
./server.sh logs     # 실시간 로그
```

## 로그 위치

```
/tmp/pasteguard.log
```

## 수동으로 실행

```bash
# 백그라운드 실행
bun run dev >> /tmp/pasteguard.log 2>&1 &
echo $! > /tmp/pasteguard.pid

# 종료
kill $(cat /tmp/pasteguard.pid)

# 또는 포트로 종료
kill $(lsof -ti:3000)
```

## 엔드포인트

| 용도 | URL |
|------|-----|
| OpenAI 프록시 | `http://localhost:3000/openai/v1/chat/completions` |
| Anthropic 프록시 | `http://localhost:3000/anthropic/v1/messages` |
| 헬스체크 | `http://localhost:3000/health` |
| 대시보드 | `http://localhost:3000/dashboard` |

## Claude CLI 연동

```bash
ANTHROPIC_BASE_URL=http://localhost:3000/anthropic claude
```
