import type { OrchestrationMode } from "./contracts";

export interface SubagentPlan {
  mode: OrchestrationMode;
  tasks: string[];
}

const DEFAULT_TASK = "Produce concise final response with explicit assumptions and outcomes.";

function inferTasks(query: string): string[] {
  const normalized = query.toLowerCase();
  const tasks: string[] = [];

  if (normalized.includes("analy")) {
    tasks.push("Analyze prior outputs and identify contradictions.");
  }
  if (normalized.includes("test") || normalized.includes("verify")) {
    tasks.push("Run focused validation and capture concrete pass/fail evidence.");
  }
  if (normalized.includes("deploy")) {
    tasks.push("Check deployment readiness and rollout constraints.");
  }
  if (normalized.includes("cost") || normalized.includes("cache")) {
    tasks.push("Evaluate prompt reuse and cost-control opportunities.");
  }
  if (normalized.includes("memory") || normalized.includes("context")) {
    tasks.push("Review context loading and compaction behavior.");
  }

  return tasks.length > 0 ? tasks : [DEFAULT_TASK];
}

export function planSubagents(query: string, mode: OrchestrationMode): SubagentPlan {
  const inferred = inferTasks(query);
  switch (mode) {
    case "fork":
      return {
        mode,
        tasks: inferred.slice(0, 3),
      };
    case "teammate":
      return {
        mode,
        tasks: ["Split tasks into pane-level ownership and exchange results via files.", ...inferred.slice(0, 2)],
      };
    case "worktree":
      return {
        mode,
        tasks: ["Run risky changes in an isolated worktree before merge.", ...inferred.slice(0, 2)],
      };
    default:
      return {
        mode: "single",
        tasks: inferred.slice(0, 1),
      };
  }
}

