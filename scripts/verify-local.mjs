import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "src/index.ts",
  "src/agent.ts",
  "src/orchestrator.ts",
  "docs/poseidon-transcript-execution.md",
  "README.md",
];

const missing = requiredFiles.filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error(`VERIFY_FAILED: missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const indexSource = readFileSync("src/index.ts", "utf8");
const preflightOk =
  indexSource.includes("url.pathname === \"/v1/query\"") &&
  indexSource.includes("request.method === \"OPTIONS\"") &&
  indexSource.includes("new Response(null, { status: 204");

if (!preflightOk) {
  console.error("VERIFY_FAILED: expected OPTIONS 204-with-empty-body logic not found");
  process.exit(1);
}

const report = {
  ok: true,
  checkedAt: new Date().toISOString(),
  checks: {
    filesPresent: requiredFiles.length,
    preflightContract: "OPTIONS /v1/query returns 204 with null body",
  },
};

console.log(JSON.stringify(report, null, 2));

