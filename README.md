# Project Poseidon

Project Poseidon is now the primary workspace for transcript-driven agent runtime execution.

## What This Repo Contains
- Handoff artifacts:
  - `GPT53_CODEX_CHAT_EXECUTION_HANDOFF.md`
  - `GPT53_CODEX_CHAT_EXECUTION_HANDOFF.json`
- Transcript execution mapping:
  - `docs/poseidon-transcript-execution.md`
- Runtime implementation:
  - `src/index.ts` (HTTP API + routing)
  - `src/agent.ts` (Cloudflare Agent state + KAIROS-style heartbeat)
  - `src/orchestrator.ts` (query engine loop)
  - `src/tools.ts` (tools layer)
  - `src/prompt-cache.ts` (cache layer)
  - `src/memory.ts` (multi-layer memory + compaction retry cap)
  - `src/multi-agent.ts` (fork/teammate/worktree planning)
  - `src/guardrails.ts` (defensive controls)
- Verification artifacts and reports:
  - `reports/*`
  - `artifacts/playwright/20260408-120529/*`

## API Endpoints
- `GET /health`
- `GET /version`
- `GET /v1/architecture`
- `POST /v1/query`
- `OPTIONS /v1/query` (`204` empty body)

## Local Commands
```bash
npm install
npm run cf:types
npm run typecheck
npm run check:start
npm run verify:local
```

Optional live smoke:
```bash
POSEIDON_BASE_URL="https://<your-worker>.workers.dev" npm run smoke:live
```

## Notes
- Existing Newzen run evidence remains preserved under `reports/` and `artifacts/`.
- Cloudflare MCP plugin account auth can still fail independently of CLI deployment state.
