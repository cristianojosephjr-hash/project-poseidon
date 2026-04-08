export interface SessionEvent {
  ts: string;
  event: string;
}

export interface MemoryState {
  pointers: string[];
  taskKnowledge: Record<string, string>;
  sessionEvents: SessionEvent[];
  compactionCount: number;
  compactionRetries: number;
  lastCompactionAt?: string;
}

export function createInitialMemoryState(): MemoryState {
  return {
    pointers: [],
    taskKnowledge: {},
    sessionEvents: [],
    compactionCount: 0,
    compactionRetries: 0,
  };
}

function uniquePush(list: string[], value: string, cap: number): string[] {
  const withoutExisting = list.filter((entry) => entry !== value);
  const next = [value, ...withoutExisting];
  return next.slice(0, cap);
}

export function addPointer(state: MemoryState, pointer: string): MemoryState {
  const trimmed = pointer.trim();
  if (!trimmed) {
    return state;
  }
  return {
    ...state,
    pointers: uniquePush(state.pointers, trimmed, 32),
  };
}

export function addTaskKnowledge(state: MemoryState, key: string, value: string): MemoryState {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return state;
  }
  const taskKnowledge = { ...state.taskKnowledge, [normalizedKey]: value };
  const entries = Object.entries(taskKnowledge);
  if (entries.length <= 64) {
    return { ...state, taskKnowledge };
  }
  const trimmed = entries.slice(entries.length - 64);
  return {
    ...state,
    taskKnowledge: Object.fromEntries(trimmed),
  };
}

export function addSessionEvent(state: MemoryState, event: string): MemoryState {
  const sessionEvents = [...state.sessionEvents, { ts: new Date().toISOString(), event }];
  return {
    ...state,
    sessionEvents: sessionEvents.slice(-200),
  };
}

export function buildMemoryContext(state: MemoryState, includeMemory: boolean): string[] {
  if (!includeMemory) {
    return [];
  }
  const pointerContext = state.pointers.slice(0, 8).map((value) => `pointer:${value}`);
  const knowledgeContext = Object.entries(state.taskKnowledge)
    .slice(-6)
    .map(([key, value]) => `knowledge:${key}=${value}`);
  const eventContext = state.sessionEvents.slice(-6).map((item) => `event:${item.event}`);
  return [...pointerContext, ...knowledgeContext, ...eventContext];
}

export function maybeCompactMemory(
  state: MemoryState,
  maxEvents: number,
  retryLimit: number,
): MemoryState {
  if (state.sessionEvents.length <= maxEvents) {
    return state;
  }

  if (state.compactionRetries >= retryLimit) {
    const fallbackSummary = `compaction retry limit reached; dropped ${state.sessionEvents.length - maxEvents} events`;
    return {
      ...state,
      sessionEvents: state.sessionEvents.slice(-maxEvents),
      compactionCount: state.compactionCount + 1,
      lastCompactionAt: new Date().toISOString(),
      pointers: uniquePush(state.pointers, fallbackSummary, 32),
    };
  }

  // First try: summarize the oldest half, then keep the newest window.
  const oldSegment = state.sessionEvents.slice(0, Math.floor(state.sessionEvents.length / 2));
  const newestSegment = state.sessionEvents.slice(-maxEvents);
  const summary = `compacted ${oldSegment.length} events into summary`;

  return {
    ...state,
    sessionEvents: newestSegment,
    compactionCount: state.compactionCount + 1,
    compactionRetries: state.compactionRetries + 1,
    lastCompactionAt: new Date().toISOString(),
    pointers: uniquePush(state.pointers, summary, 32),
  };
}

