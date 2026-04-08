import { Agent, type Connection } from "agents";
import type { QueryRequest, QueryResponse } from "./contracts";
import { parseQueryRequest } from "./contracts";
import { executeOrchestration } from "./orchestrator";
import { addPointer, addSessionEvent, createInitialMemoryState } from "./memory";
import type { PoseidonState } from "./types";

type RuntimeEnv = Env & {
  KAIROS_ENABLED?: string;
};

function isKairosEnabled(env: RuntimeEnv): boolean {
  return (env.KAIROS_ENABLED ?? "false").toLowerCase() === "true";
}

export class PoseidonAgent extends Agent<Env, PoseidonState> {
  initialState: PoseidonState = {
    queryCount: 0,
    summary: "Poseidon initialized.",
    memory: createInitialMemoryState(),
    kairos: {
      enabled: false,
      heartbeatCount: 0,
    },
  };

  private ensureStateShape(): void {
    const state = this.state as Partial<PoseidonState>;
    const valid =
      typeof state.queryCount === "number" &&
      typeof state.summary === "string" &&
      !!state.memory &&
      Array.isArray(state.memory.pointers) &&
      Array.isArray(state.memory.sessionEvents) &&
      typeof state.memory.taskKnowledge === "object" &&
      !!state.kairos &&
      typeof state.kairos.enabled === "boolean" &&
      typeof state.kairos.heartbeatCount === "number";
    if (valid) {
      return;
    }
    this.setState(this.initialState);
  }

  validateStateChange(nextState: PoseidonState): void {
    if (nextState.queryCount < 0) {
      throw new Error("queryCount cannot be negative");
    }
    if (nextState.memory.sessionEvents.length > 300) {
      throw new Error("session event window exceeded");
    }
  }

  async onStart(): Promise<void> {
    this.ensureStateShape();
    const env = this.env as RuntimeEnv;
    if (isKairosEnabled(env) && !this.state.kairos.enabled) {
      const withKairos = {
        ...this.state,
        kairos: {
          ...this.state.kairos,
          enabled: true,
        },
        memory: addSessionEvent(this.state.memory, "kairos_enabled"),
      };
      this.setState(withKairos);
    }

    if (isKairosEnabled(env)) {
      await this.scheduleEvery(900, "kairosHeartbeat", undefined, { _idempotent: true });
    }
  }

  async onConnect(connection: Connection): Promise<void> {
    this.ensureStateShape();
    connection.send(
      JSON.stringify({
        type: "agent-ready",
        queryCount: this.state.queryCount,
        kairosEnabled: this.state.kairos.enabled,
      }),
    );
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    this.ensureStateShape();
    const incoming =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(incoming);
    } catch {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "INVALID_JSON",
          error: "message must be valid JSON",
        }),
      );
      return;
    }

    if (!parsedBody || typeof parsedBody !== "object") {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "INVALID_MESSAGE",
          error: "message must be an object",
        }),
      );
      return;
    }

    const record = parsedBody as Record<string, unknown>;
    const kind = typeof record.type === "string" ? record.type : "query";
    if (kind === "status") {
      connection.send(
        JSON.stringify({
          type: "status",
          data: this.getRuntimeSnapshot(),
        }),
      );
      return;
    }

    const parsed = parseQueryRequest({
      instance: record.instance ?? "default",
      query: record.query,
      mode: record.mode,
      allowNetwork: record.allowNetwork,
      includeMemory: record.includeMemory,
      maxCycles: record.maxCycles,
    });

    if (!parsed.ok) {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "VALIDATION_ERROR",
          error: parsed.error,
        }),
      );
      return;
    }

    const traceId = crypto.randomUUID();
    const result = await this.runQuery(parsed.value, traceId);
    connection.send(
      JSON.stringify({
        type: "query-result",
        trace_id: traceId,
        data: result,
      }),
    );
  }

  async runQuery(input: QueryRequest, traceId: string = crypto.randomUUID()): Promise<QueryResponse> {
    this.ensureStateShape();
    const execution = await executeOrchestration(this.env, this.state, input, traceId);
    this.setState(execution.nextState);
    return execution.response;
  }

  async kairosHeartbeat(): Promise<void> {
    this.ensureStateShape();
    const next = {
      ...this.state,
      kairos: {
        ...this.state.kairos,
        heartbeatCount: this.state.kairos.heartbeatCount + 1,
        lastHeartbeatAt: new Date().toISOString(),
      },
      memory: addPointer(
        addSessionEvent(this.state.memory, "kairos_heartbeat"),
        `kairos:beat:${Date.now()}`,
      ),
    };
    this.setState(next);
  }

  getRuntimeSnapshot(): {
    queryCount: number;
    summary: string;
    kairos: PoseidonState["kairos"];
    memory: {
      pointers: string[];
      sessionEventCount: number;
      taskKnowledgeKeys: string[];
      compactionCount: number;
    };
  } {
    this.ensureStateShape();
    return {
      queryCount: this.state.queryCount,
      summary: this.state.summary,
      kairos: this.state.kairos,
      memory: {
        pointers: this.state.memory.pointers.slice(0, 10),
        sessionEventCount: this.state.memory.sessionEvents.length,
        taskKnowledgeKeys: Object.keys(this.state.memory.taskKnowledge),
        compactionCount: this.state.memory.compactionCount,
      },
    };
  }
}

