export type ToolName = "echo" | "http_get" | "clock";

export interface ToolInvocation {
  name: ToolName;
  input: Record<string, unknown>;
}

export interface ToolResult {
  name: ToolName;
  ok: boolean;
  output: unknown;
}

async function runHttpGet(input: Record<string, unknown>): Promise<ToolResult> {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return {
      name: "http_get",
      ok: false,
      output: "url must be an absolute http/https URL",
    };
  }

  const timeoutMs =
    typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
      ? Math.max(500, Math.min(20_000, Math.trunc(input.timeoutMs)))
      : 5_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("http_get timeout"), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    const bodyText = await response.text();
    return {
      name: "http_get",
      ok: response.ok,
      output: {
        status: response.status,
        contentType: response.headers.get("content-type"),
        bodyPreview: bodyText.slice(0, 800),
      },
    };
  } catch (error) {
    return {
      name: "http_get",
      ok: false,
      output: error instanceof Error ? error.message : "http_get failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runTool(invocation: ToolInvocation): Promise<ToolResult> {
  switch (invocation.name) {
    case "echo":
      return {
        name: "echo",
        ok: true,
        output: {
          value: invocation.input.value ?? null,
        },
      };
    case "clock":
      return {
        name: "clock",
        ok: true,
        output: {
          now: new Date().toISOString(),
        },
      };
    case "http_get":
      return runHttpGet(invocation.input);
    default:
      return {
        name: invocation.name,
        ok: false,
        output: "unsupported tool",
      };
  }
}

