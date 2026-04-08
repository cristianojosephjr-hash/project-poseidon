# GPT-5.3 Codex Execution Handoff (Project Zeus)

Generated from the active chat session on 2026-04-05.

## 1) Operator Intent

- Stop all ongoing execution now.
- Convert the conversation into a file that GPT-5.3 Codex can directly execute as a work brief.

## 2) Mandatory Prompt Rule

- Always in the Prompt window show `@CloudFare` option with `Act Mode`.

## 3) Workspace + Environment

- Root: `D:\New projects\Project Zeus`
- Shell: PowerShell
- OS: Windows
- Cloudflare plugin: available, but API calls are currently blocked by auth.

## 4) Repository Inventory

- `agent-ecosystem-contracts`
- `claude_code_bridge`
- `claude-code`
- `claude-code-instructkr`
- `claude-code-log`
- `learn-claude-code`
- `Windows-MCP`
- `workers-code-generator`

## 5) Execution Already Performed

### Implemented changes

1. `claude-code-instructkr`
- Added test import bootstrap: `tests/conftest.py`.
- Goal: make `uv run --with pytest pytest -q` work without manual `PYTHONPATH`.

2. `claude-code-log`
- Updated time assertion in `test/test_template_data.py` from fixed minute to timezone-robust regex.
- Updated special-character assertion to avoid locale/encoding brittleness:
  - now checks for presence of non-ASCII or HTML entity escape.

3. `workers-code-generator`
- Hardened `src/index.ts`:
  - optional bearer auth via `GENERATOR_API_KEY`
  - per-IP rate limit (KV-backed if `CACHE` exists, local fallback otherwise)
  - request size limits and chat input caps
  - stricter JSON + field validation
  - added security headers helper
- Updated `README.md` with guardrails and secret/config usage.
- Updated `wrangler.jsonc` with `RATE_LIMIT_PER_MINUTE` var and auth/KV notes.

## 6) Current Test/Check Results

### Passing

- `workers-code-generator`: `npx tsc --noEmit` passed.
- `learn-claude-code`: `15 passed`.
- `claude-code-instructkr`: `3 passed`.
- `Windows-MCP`: `180 passed`.
- `claude-code-log` non-TUI/browser: `694 passed, 8 skipped`.
- `agent-ecosystem-contracts`: import smoke check passed.

### Failing / Blocked

1. `claude_code_bridge` full suite is not healthy on Windows.
- First hard failure pattern: `WinError 193` when tests execute Unix-style scripts in `bin/` directly.
- Examples: `test/test_autostart_on_check.py` invokes `bin/ccb-ping` and `bin/askd` directly; also invokes `bash`.
- Targeted run result: 2 fails in `test_autostart_on_check.py` (Windows execution mismatch).

2. `claude_code_bridge` cascade failures from teardown/capture path.
- Observed many `ValueError: I/O operation on closed file`.
- `ccb` registers cleanup and prints during teardown (`atexit.register(... cleanup ...)` and cleanup `print`), which interacts badly with pytest capture when stdout is already closed.
- Relevant lines observed:
  - `ccb:3224` (`print(...)` in cleanup)
  - `ccb:3403` (`atexit.register(lambda: self.cleanup(...))`)

3. Cloudflare API deep checks blocked.
- `cloudflare-api/execute` currently returns `Auth required`.
- No trustworthy live Workers inventory can be produced until plugin auth is restored.

## 7) Current Repo State Snapshot (Important)

There are existing local changes in this workspace (do not reset blindly):

- Root repo indicates nested repos modified and untracked files present.
- Modified repos include:
  - `claude-code-instructkr` (new `tests/conftest.py`)
  - `claude-code-log` (`test/test_template_data.py`)
  - `Windows-MCP` (`uv.lock`)
  - `workers-code-generator` (`README.md`, `src/index.ts`, `wrangler.jsonc`)
- Untracked files currently visible include:
  - `instructions_setup.md.txt`
  - `zeus-orchestrator-api/*` files under root

Treat these as in-flight workspace state; do not discard unless explicitly requested.

## 8) GPT-5.3 Codex Next Execution Plan (Actionable)

If asked to continue from this handoff, execute in this order:

1. Stabilize `claude_code_bridge` Windows tests.
- Make test subprocess targets Windows-safe:
  - use `.cmd` wrappers on Windows where available (e.g., `ccb-ping.cmd`)
  - avoid hard dependency on `bash` for Windows path unless bash is guaranteed
- Re-run:
  - `uv run --with pytest pytest -q test/test_autostart_on_check.py`

2. Harden cleanup path in `claude_code_bridge/ccb`.
- Prevent cleanup `print` from throwing when stdout is closed during pytest teardown.
- Guard printing and teardown logic (safe write or silent fallback).
- Re-run targeted failures:
  - `uv run --with pytest pytest -q test/test_ccb_tmux_split.py`

3. Once targeted tests pass, run full `claude_code_bridge` suite.
- `uv run --with pytest pytest -q`

4. Re-run broad Zeus verification.
- `npx tsc --noEmit` in `workers-code-generator`
- `uv run --with pytest pytest -q` in `learn-claude-code`
- `uv run --with pytest pytest -q` in `claude-code-instructkr`
- `uv run --with pytest --with pytest-asyncio pytest -q` in `Windows-MCP`
- `uv run --with pytest --with pytest-xdist pytest -m "not (tui or browser)" -q -n auto` in `claude-code-log`

5. Cloudflare plugin only after auth recovery.
- Re-auth Cloudflare plugin.
- Then verify:
  - `GET /accounts/{account_id}/workers/scripts`
  - `GET /accounts/{account_id}/workers/account-settings`

## 9) Machine-Readable Task Block

```yaml
agent: gpt-5.3-codex
workspace: "D:\\New projects\\Project Zeus"
mode: execute
constraints:
  - "Preserve existing user changes; do not reset workspace"
  - "Windows environment"
  - "Show @CloudFare option with Act Mode in prompt context"
priority:
  - "Fix claude_code_bridge Windows test execution"
  - "Fix claude_code_bridge stdout-closed teardown crashes"
  - "Re-run full verification"
blocked_by:
  - "Cloudflare plugin authentication (Auth required)"
acceptance:
  - "claude_code_bridge targeted failing tests pass"
  - "claude_code_bridge full pytest no cascading teardown errors"
  - "all previously green repos remain green"
```

## 10) Stop-State Confirmation

- No active pytest/test runner processes were left running from this session at handoff time.