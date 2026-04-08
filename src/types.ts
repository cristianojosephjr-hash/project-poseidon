import type { MemoryState } from "./memory";

export interface PoseidonRuntimeEnv {
  ENVIRONMENT?: string;
  APP_VERSION?: string;
  MAX_AGENT_CYCLES?: string;
  COMPACTION_RETRY_LIMIT?: string;
  KAIROS_ENABLED?: string;
}

export interface PoseidonState {
  queryCount: number;
  lastTraceId?: string;
  summary: string;
  memory: MemoryState;
  kairos: {
    enabled: boolean;
    heartbeatCount: number;
    lastHeartbeatAt?: string;
  };
}

