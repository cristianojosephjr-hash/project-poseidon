import type { QueryRequest, QueryResponse } from "./contracts";
import { evaluateGuardrails } from "./guardrails";
import {
  addPointer,
  addSessionEvent,
  addTaskKnowledge,
  buildMemoryContext,
  maybeCompactMemory,
} from "./memory";
import { planSubagents } from "./multi-agent";
import { resolveCachedPrompt } from "./prompt-cache";
import { runTool } from "./tools";
import type { PoseidonRuntimeEnv, PoseidonState } from "./types";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function extractUrl(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0];
}

function buildSystemPrompt(): string {
  return [
    "Poseidon Query Engine",
    "1) iterate in explicit cycles",
    "2) use tools only when needed",
    "3) reuse static prompt blocks via cache",
    "4) keep memory compact and auditable",
    "5) prefer deterministic outputs over speculative claims",
  ].join("\n");
}

export interface OrchestrationResult {
  response: QueryResponse;
  nextState: PoseidonState;
}

export async function executeOrchestration(
  env: PoseidonRuntimeEnv,
  currentState: PoseidonState,
  request: QueryRequest,
  traceId: string,
): Promise<OrchestrationResult> {
  const startedAt = Date.now();
  const maxCycles = request.maxCycles ?? parsePositiveInt(env.MAX_AGENT_CYCLES, 10);
  const retryLimit = parsePositiveInt(env.COMPACTION_RETRY_LIMIT, 3);
  const guardrails = evaluateGuardrails(request.query);
  const cache = resolveCachedPrompt("poseidon.system.v1", buildSystemPrompt);
  const subagentPlan = planSubagents(request.query, request.mode);
  const invokedTools: string[] = [];

  let nextState: PoseidonState = {
    ...currentState,
    queryCount: currentState.queryCount + 1,
    lastTraceId: traceId,
    memory: addSessionEvent(
      addPointer(currentState.memory, `trace:${traceId}`),
      `query_received:${request.query.slice(0, 120)}`,
    ),
  };

  if (!guardrails.allow) {
    nextState = {
      ...nextState,
      memory: addSessionEvent(nextState.memory, "guardrail_blocked_query"),
      summary: "Last request blocked by guardrail policy.",
    };
    return {
      response: {
        traceId,
        summary: `Blocked by guardrail: ${guardrails.reason ?? "policy violation"}`,
        cycleCount: 1,
        cache: { hit: cache.hit, key: cache.key },
        memory: {
          pointers: nextState.memory.pointers.slice(0, 8),
          taskKnowledgeKeys: Object.keys(nextState.memory.taskKnowledge),
          sessionEventCount: nextState.memory.sessionEvents.length,
          compactionCount: nextState.memory.compactionCount,
          compactionRetries: nextState.memory.compactionRetries,
        },
        subagents: {
          mode: subagentPlan.mode,
          taskCount: subagentPlan.tasks.length,
          tasks: subagentPlan.tasks,
        },
        tools: { invoked: invokedTools },
        guardrails: { blockedPatterns: guardrails.blockedPatterns },
      },
      nextState,
    };
  }

  const memoryContext = buildMemoryContext(nextState.memory, request.includeMemory);
  let summary = "";
  let cycleCount = 0;

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    cycleCount = cycle;
    nextState = {
      ...nextState,
      memory: addSessionEvent(nextState.memory, `cycle_${cycle}_start`),
    };

    if (cycle === 1) {
      const url = request.allowNetwork ? extractUrl(request.query) : undefined;
      if (url) {
        const result = await runTool({ name: "http_get", input: { url, timeoutMs: 6000 } });
        invokedTools.push(result.name);
        nextState = {
          ...nextState,
          memory: addTaskKnowledge(
            addSessionEvent(nextState.memory, `tool_${result.name}_${result.ok ? "ok" : "fail"}`),
            "last_http_get",
            JSON.stringify(result.output).slice(0, 700),
          ),
        };
        summary = `Executed ${result.name} for URL insight; result ok=${result.ok}.`;
      } else {
        const clockResult = await runTool({ name: "clock", input: {} });
        invokedTools.push(clockResult.name);
        summary = "No external URL detected; completed local reasoning cycle.";
      }
      continue;
    }

    if (cycle === 2) {
      summary = [
        "Poseidon completed orchestration.",
        `Mode=${subagentPlan.mode}.`,
        `Subtasks=${subagentPlan.tasks.length}.`,
        `MemoryContext=${memoryContext.length} items.`,
      ].join(" ");
      break;
    }
  }

  nextState = {
    ...nextState,
    summary,
    memory: maybeCompactMemory(nextState.memory, 120, retryLimit),
  };

  nextState = {
    ...nextState,
    memory: addSessionEvent(nextState.memory, `query_completed_in_${Date.now() - startedAt}ms`),
  };

  return {
    response: {
      traceId,
      summary,
      cycleCount,
      cache: { hit: cache.hit, key: cache.key },
      memory: {
        pointers: nextState.memory.pointers.slice(0, 8),
        taskKnowledgeKeys: Object.keys(nextState.memory.taskKnowledge),
        sessionEventCount: nextState.memory.sessionEvents.length,
        compactionCount: nextState.memory.compactionCount,
        compactionRetries: nextState.memory.compactionRetries,
      },
      subagents: {
        mode: subagentPlan.mode,
        taskCount: subagentPlan.tasks.length,
        tasks: subagentPlan.tasks,
      },
      tools: {
        invoked: invokedTools,
      },
      guardrails: {
        blockedPatterns: guardrails.blockedPatterns,
      },
    },
    nextState,
  };
}

