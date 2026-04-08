import { getAgentByName, routeAgentRequest } from "agents";
import { PoseidonAgent } from "./agent";
import { parseInstanceName, parseQueryRequest } from "./contracts";

export { PoseidonAgent };

type RuntimeEnv = Env & {
  APP_VERSION?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  POSEIDON_AGENT: DurableObjectNamespace<PoseidonAgent>;
};

const SERVICE_NAME = "poseidon-agent-service";

function corsHeaders(env: RuntimeEnv): Record<string, string> {
  const origin = env.ALLOWED_ORIGIN?.trim() || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,x-request-id",
    "access-control-max-age": "86400",
  };
}

function responseWithJson(env: RuntimeEnv, status: number, body: unknown, traceId?: string): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(env),
  };
  if (traceId) {
    headers["x-trace-id"] = traceId;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function preflight(env: RuntimeEnv, traceId?: string): Response {
  const headers: Record<string, string> = { ...corsHeaders(env) };
  if (traceId) {
    headers["x-trace-id"] = traceId;
  }
  return new Response(null, { status: 204, headers });
}

async function parseJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

function nowIso(): string {
  return new Date().toISOString();
}

export default {
  async fetch(request: Request, rawEnv: Env): Promise<Response> {
    const env = rawEnv as RuntimeEnv;
    const traceId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const url = new URL(request.url);
    const startedAt = Date.now();

    const agentRouted = await routeAgentRequest(request, env);
    if (agentRouted) {
      return agentRouted;
    }

    if (url.pathname === "/v1/query") {
      if (request.method === "OPTIONS") {
        return preflight(env, traceId);
      }

      if (request.method !== "POST") {
        return responseWithJson(
          env,
          405,
          {
            trace_id: traceId,
            status: "error",
            latency_ms: Date.now() - startedAt,
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "only POST /v1/query is supported",
            },
          },
          traceId,
        );
      }

      let body: unknown;
      try {
        body = await parseJsonBody(request);
      } catch {
        return responseWithJson(
          env,
          400,
          {
            trace_id: traceId,
            status: "error",
            latency_ms: Date.now() - startedAt,
            error: {
              code: "INVALID_JSON",
              message: "request body must be valid JSON",
            },
          },
          traceId,
        );
      }

      const parsed = parseQueryRequest(body);
      if (!parsed.ok) {
        return responseWithJson(
          env,
          400,
          {
            trace_id: traceId,
            status: "error",
            latency_ms: Date.now() - startedAt,
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error,
            },
          },
          traceId,
        );
      }

      const parsedInstance = parseInstanceName(parsed.value.instance);
      if (!parsedInstance.ok) {
        return responseWithJson(
          env,
          400,
          {
            trace_id: traceId,
            status: "error",
            latency_ms: Date.now() - startedAt,
            error: {
              code: "VALIDATION_ERROR",
              message: parsedInstance.error,
            },
          },
          traceId,
        );
      }

      try {
        const agent = await getAgentByName<Env, PoseidonAgent>(
          env.POSEIDON_AGENT,
          parsedInstance.value as unknown as `${string}-${string}-${string}-${string}-${string}`,
        );
        const result = await agent.runQuery(parsed.value, traceId);
        return responseWithJson(
          env,
          200,
          {
            trace_id: traceId,
            status: "ok",
            latency_ms: Date.now() - startedAt,
            data: result,
          },
          traceId,
        );
      } catch (error) {
        return responseWithJson(
          env,
          500,
          {
            trace_id: traceId,
            status: "error",
            latency_ms: Date.now() - startedAt,
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "unexpected runtime error",
            },
          },
          traceId,
        );
      }
    }

    if (url.pathname === "/health") {
      return responseWithJson(
        env,
        200,
        {
          ok: true,
          service: SERVICE_NAME,
          environment: env.ENVIRONMENT ?? "unknown",
          timestamp: nowIso(),
        },
        traceId,
      );
    }

    if (url.pathname === "/version") {
      return responseWithJson(
        env,
        200,
        {
          service: SERVICE_NAME,
          runtime: "cloudflare-workers",
          agent_class: "PoseidonAgent",
          build: env.APP_VERSION ?? "poseidon-v1",
          timestamp: nowIso(),
        },
        traceId,
      );
    }

    if (url.pathname === "/v1/architecture") {
      return responseWithJson(
        env,
        200,
        {
          service: SERVICE_NAME,
          query_engine: "cycle-based orchestrator",
          tools_layer: ["echo", "http_get", "clock"],
          prompt_cache: "static prompt key poseidon.system.v1",
          memory_layers: ["pointers", "taskKnowledge", "sessionEvents"],
          multi_agent_modes: ["single", "fork", "teammate", "worktree"],
          defensive_controls: ["pattern guardrails", "decoy tool catalog", "compaction retry cap"],
        },
        traceId,
      );
    }

    return responseWithJson(
      env,
      404,
      {
        trace_id: traceId,
        status: "error",
        latency_ms: Date.now() - startedAt,
        error: {
          code: "NOT_FOUND",
          message: "unsupported route",
        },
      },
      traceId,
    );
  },
};

