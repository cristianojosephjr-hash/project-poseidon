# Deep Test Execution Report

Generated: 2026-04-08T12:08 IST  
Workspace: `D:\New projects\Project newzen`

## Scope Executed
- Re-validated local compile/check suite.
- Deployed current source to Cloudflare staging and production.
- Ran deep live API matrix (staging + production + netlify).
- Ran browser-level Playwright checks from scratch.
- Re-validated Netlify and GitHub connector access.
- Re-ran Cloudflare MCP 5-call auth sequence from `PLAN.md`.

## Commands Executed
- `npm run cf:types`
- `npm run check`
- `npx tsc --noEmit`
- `npm run smoke:live`
- `npm run deploy:staging`
- `npm run deploy:prod`
- `npx wrangler deployments list --env staging`
- `npx wrangler deployments list --env production`
- Node-based deep matrix run (saved to `output/test-runs/20260408-120341/live-matrix.json`)
- Playwright CLI runs using:
  - `npx --yes --package @playwright/cli playwright-cli ...`
  - sessions: `staging`, `production`, `netlify`
- Connector checks:
  - Netlify: `get-user`, `get-projects`
  - GitHub: `get_profile`, `search_repositories`, `search_installed_repositories_v2`
  - Cloudflare MCP: 5 validation calls

## Local Build/Test Status
- `wrangler types`: pass
- `wrangler check startup`: pass
- `npx tsc --noEmit`: pass
- `npm run smoke:live`: pass

## Cloudflare Deploy Status
- Staging deployed URL: `https://newzen-service-staging.zeussimcrist2026.workers.dev`
- Staging current version ID: `bb9c8ed7-cedb-49b8-b736-e4ffc71e4982`
- Production deployed URL: `https://newzen-service-production.zeussimcrist2026.workers.dev`
- Production current version ID: `2a3b7aa2-c75a-4518-af5b-1c8fb285a72d`

`wrangler deployments list` confirms these versions as latest entries for each env.

## Deep Live API Matrix
Source: `output/test-runs/20260408-120341/live-matrix.json`

Summary:
- Total checks: 16
- Passed: 16
- Failed: 0

Key assertions passed:
- Staging `/version` build is `staging-v2`
- Production `/version` build is `production-v2`
- `OPTIONS /v1/chat` returns `204` with empty body (`bodyLength: 0`) on both envs
- Invalid `POST /v1/chat` returns structured `400 VALIDATION_ERROR` envelope with `trace_id`
- Valid `POST /v1/chat` returns structured `200 ok` envelope with `trace_id` and `data.content`
- `GET /v1/state?instance=default` and `GET /v1/automations?instance=default` return `200 ok` envelopes
- Netlify `HEAD /` and `GET /` both return `200`; title matches `Project Newzen`

## Playwright Deep Browser Evidence
Folder: `output/playwright/20260408-120529`

Artifacts:
- `staging-root.png`
- `production-root.png`
- `netlify-root.png`
- `staging-options.txt`, `production-options.txt`
- `staging-chat-invalid.txt`, `production-chat-invalid.txt`
- `staging-chat-valid.txt`, `production-chat-valid.txt`
- `netlify-title.txt`
- `staging-console.txt`, `production-console.txt`, `netlify-console.txt`

Browser-verified results:
- Staging preflight: `{"status":204,"bodyLength":0,...}`
- Production preflight: `{"status":204,"bodyLength":0,...}`
- Staging invalid chat: `400`, `VALIDATION_ERROR`, trace id present
- Production invalid chat: `400`, `VALIDATION_ERROR`, trace id present
- Staging valid chat: `200`, envelope `ok`, content present
- Production valid chat: `200`, envelope `ok`, content present
- Netlify title: `Project Newzen`

Note on console entries:
- Worker pages show one expected console error from intentional invalid chat probe (`400`).
- Netlify shows favicon `404` warning.

## Connector Validation
- Netlify `get-user`: pass
- Netlify `get-projects`: pass (`project-newzen-20260405`, deploy `69d272ebc1d67ec79f78566a`, state `ready`)
- GitHub profile: pass (`mrsmithx2970`)
- GitHub search for `newzen`: no matching installed repos returned (read path works)

## Cloudflare MCP Validation (Plan 5-call Sequence)
Target account: `892897b63066abdd897d63d050555ff0`

All 5 calls still fail with:
- `10000 Authentication error`

Endpoints tested:
- `/workers/account-settings`
- `/workers/scripts`
- `/pages/projects`
- `/r2/buckets`
- `/d1/database`

## Source Issue Status
- `OPTIONS 204 with body` bug: not reproducible; verified fixed behavior (`204` + empty body) in API matrix and browser tests.
- TypeScript errors: not reproducible; `npx tsc --noEmit` passes.

No source code edits were required in this execution run.

## Remaining External Steps
1. Reconnect Cloudflare MCP plugin auth in Codex app to clear `10000` errors and unlock Workers inventory via MCP.
2. Provide target GitHub repository if you want this report published through connector write actions.
