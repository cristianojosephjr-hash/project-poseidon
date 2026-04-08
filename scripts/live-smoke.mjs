const defaultBaseUrl = process.env.POSEIDON_BASE_URL || "";

if (!defaultBaseUrl) {
  console.error("SMOKE_FAILED: set POSEIDON_BASE_URL to run live smoke checks");
  process.exit(1);
}

async function mustJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { res, text, parsed };
}

async function main() {
  const checks = [];

  const health = await mustJson(`${defaultBaseUrl}/health`);
  checks.push({
    check: "GET /health",
    status: health.res.status,
    ok: health.res.ok && health.parsed?.ok === true,
  });

  const version = await mustJson(`${defaultBaseUrl}/version`);
  checks.push({
    check: "GET /version",
    status: version.res.status,
    ok: version.res.ok && typeof version.parsed?.build === "string",
  });

  const preflight = await fetch(`${defaultBaseUrl}/v1/query`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const preflightBody = await preflight.text();
  checks.push({
    check: "OPTIONS /v1/query",
    status: preflight.status,
    ok: preflight.status === 204 && preflightBody.length === 0,
  });

  const query = await mustJson(`${defaultBaseUrl}/v1/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instance: "default",
      query: "Analyze memory + cache + tools behavior.",
      mode: "fork",
      includeMemory: true,
      allowNetwork: false,
    }),
  });
  checks.push({
    check: "POST /v1/query",
    status: query.res.status,
    ok:
      query.res.status === 200 &&
      query.parsed?.status === "ok" &&
      typeof query.parsed?.data?.summary === "string",
  });

  const failed = checks.filter((item) => !item.ok);
  const result = {
    ok: failed.length === 0,
    baseUrl: defaultBaseUrl,
    checks,
  };

  console.log(JSON.stringify(result, null, 2));
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`SMOKE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

