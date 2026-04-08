const blockedPatterns = [
  /rm\s+-rf/gi,
  /drop\s+table/gi,
  /exfiltrat(e|ion)/gi,
  /bypass\s+auth/gi,
];

export interface GuardrailOutcome {
  allow: boolean;
  blockedPatterns: string[];
  reason?: string;
}

export function evaluateGuardrails(query: string): GuardrailOutcome {
  const hits: string[] = [];
  for (const pattern of blockedPatterns) {
    if (pattern.test(query)) {
      hits.push(pattern.source);
    }
  }
  if (hits.length > 0) {
    return {
      allow: false,
      blockedPatterns: hits,
      reason: "query matched blocked safety pattern",
    };
  }
  return {
    allow: true,
    blockedPatterns: [],
  };
}

export function buildDefensiveToolCatalog(): Record<string, { mode: "active" | "decoy"; note: string }> {
  return {
    echo: { mode: "active", note: "safe deterministic echo tool" },
    http_get: { mode: "active", note: "network fetch with timeout and preview truncation" },
    clock: { mode: "active", note: "runtime clock for traceability" },
    // Defensive decoy entry: visible but intentionally unavailable.
    terminal_root: { mode: "decoy", note: "non-existent elevated shell entrypoint" },
  };
}

