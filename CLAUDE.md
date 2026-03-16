# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Hot-reload dev server
bun test             # Run all tests
bun test src/path/to/file.test.ts  # Run single test file
bun run typecheck    # TypeScript type check
bun run check        # Lint + format check (Biome)
bun run format       # Auto-format code
bun run build        # Build to dist/
```

**Dev setup requires Presidio running:**
```bash
docker compose up presidio -d
cp config.example.yaml config.yaml
bun install
bun run dev
```

## Architecture

PasteGuard is a **privacy proxy for LLMs** — it sits between clients and AI providers (OpenAI, Anthropic), detects PII and secrets in prompts, masks them with placeholders like `[[PERSON_1]]`, forwards the sanitized request, then unmasks the response before returning it to the client.

**Two modes** (set in `config.yaml`):
- `mask` — mask/unmask in-flight for any provider
- `route` — send sensitive requests to a local LLM, clean requests to cloud

### Request Flow (mask mode)

```
Client → routes/ → masking/service.ts → pii/ + secrets/ → provider/ → unmask → Client
```

1. `src/routes/openai.ts` or `src/routes/anthropic.ts` receives the request
2. `src/masking/service.ts` orchestrates detection + masking
3. `src/pii/detect.ts` calls Presidio (external Docker service) for PII
4. `src/secrets/detect.ts` runs regex patterns from `src/secrets/patterns/`
5. `src/masking/conflict-resolver.ts` handles overlapping detection spans
6. `src/masking/context.ts` stores the placeholder↔original mapping
7. `src/providers/openai/` or `src/providers/anthropic/` forwards to the real API (supports streaming)
8. Stream transformers in `src/providers/*/stream-transformer.ts` unmask chunks as they arrive

### Key Modules

| Path | Responsibility |
|------|---------------|
| `src/config.ts` | YAML config loading with `${ENV:-default}` substitution, Zod validation, singleton |
| `src/masking/context.ts` | In-memory map of placeholders → original values per request |
| `src/masking/conflict-resolver.ts` | Merges overlapping PII/secret spans before masking |
| `src/pii/` | Presidio integration — sends text, receives entity spans |
| `src/secrets/patterns/` | Regex definitions for API keys, SSH keys, JWTs, etc. |
| `src/providers/` | OpenAI + Anthropic clients; streaming response unmask transformers |
| `src/services/logger.ts` | SQLite logging of requests (optional, configurable) |
| `src/routes/dashboard.tsx` | React/Hono JSX dashboard UI at `/dashboard` |

### Configuration

`config.yaml` (gitignored, copy from `config.example.yaml`). Key sections:
- `mode`: `mask` | `route`
- `pii_detection.presidio_url`: must point to running Presidio service
- `pii_detection.languages`: array of 2-letter codes (24 supported)
- `secrets_detection.action`: `block` | `mask` | `route_local`
- `masking.show_markers`: whether placeholders are visible in responses

### Tech Stack

- **Runtime:** Bun + TypeScript (strict mode)
- **HTTP:** Hono
- **Validation:** Zod
- **PII engine:** Microsoft Presidio (external Docker service)
- **DB:** SQLite (via Bun built-in)
- **Lint/format:** Biome (100-char line width, double quotes)
- **UI:** Hono JSX + Tailwind CSS v4
