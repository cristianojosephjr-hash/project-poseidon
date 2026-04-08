export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type OrchestrationMode = "single" | "fork" | "teammate" | "worktree";

export interface QueryRequest {
  instance: string;
  query: string;
  mode: OrchestrationMode;
  allowNetwork: boolean;
  includeMemory: boolean;
  maxCycles?: number;
}

export interface QueryResponse {
  traceId: string;
  summary: string;
  cycleCount: number;
  cache: {
    hit: boolean;
    key: string;
  };
  memory: {
    pointers: string[];
    taskKnowledgeKeys: string[];
    sessionEventCount: number;
    compactionCount: number;
    compactionRetries: number;
  };
  subagents: {
    mode: OrchestrationMode;
    taskCount: number;
    tasks: string[];
  };
  tools: {
    invoked: string[];
  };
  guardrails: {
    blockedPatterns: string[];
  };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

export function parseInstanceName(raw: unknown): Result<string> {
  const value = asTrimmedString(raw) ?? "default";
  if (value === "default") {
    return { ok: true, value };
  }
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(value)) {
    return {
      ok: false,
      error: "instance must be 'default' or an alphanumeric/hyphen value up to 64 chars",
    };
  }
  return { ok: true, value };
}

export function parseQueryRequest(raw: unknown): Result<QueryRequest> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "request body must be an object" };
  }
  const data = raw as Record<string, unknown>;
  const parsedInstance = parseInstanceName(data.instance);
  if (!parsedInstance.ok) {
    return parsedInstance;
  }

  const query = asTrimmedString(data.query);
  if (!query) {
    return { ok: false, error: "query must be a non-empty string" };
  }

  const modeRaw = asTrimmedString(data.mode) ?? "single";
  const mode: OrchestrationMode =
    modeRaw === "single" ||
    modeRaw === "fork" ||
    modeRaw === "teammate" ||
    modeRaw === "worktree"
      ? modeRaw
      : "single";

  const maxCycles = asInteger(data.maxCycles);
  if (maxCycles !== undefined && (maxCycles < 1 || maxCycles > 50)) {
    return { ok: false, error: "maxCycles must be between 1 and 50" };
  }

  return {
    ok: true,
    value: {
      instance: parsedInstance.value,
      query,
      mode,
      allowNetwork: asBoolean(data.allowNetwork, true),
      includeMemory: asBoolean(data.includeMemory, true),
      maxCycles,
    },
  };
}

