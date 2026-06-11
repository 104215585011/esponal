// 2026-06-11 11:35
import { spawn } from "node:child_process";

const args = ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";

function collect(chunk) {
  const text = chunk.toString();
  output += text;
  return text;
}

child.stdout.on("data", (chunk) => process.stdout.write(collect(chunk)));
child.stderr.on("data", (chunk) => process.stderr.write(collect(chunk)));

const timeoutMs = Number(process.env.PLAYWRIGHT_E2E_TIMEOUT_MS ?? 210_000);

function killChildTree() {
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

function didFinishAllTests() {
  const runningMatch = output.match(/Running\s+(\d+)\s+tests?/);
  if (!runningMatch) return false;

  const total = Number(runningMatch[1]);
  const passed = (output.match(/^\s+ok\s+\d+/gm) ?? []).length;
  const skipped = (output.match(/^\s+-\s+\d+/gm) ?? []).length;
  const hasFailure = /^\s*(?:x|not ok|×)\s+\d+/im.test(output);

  return total > 0 && passed + skipped >= total && !hasFailure;
}

const timer = setTimeout(() => {
  killChildTree();
  if (didFinishAllTests()) {
    console.warn(
      "[e2e] Playwright completed all tests but the dev-server teardown did not exit before the watchdog timeout."
    );
    process.exit(0);
  }
  console.error("[e2e] Playwright timed out before all tests completed.");
  process.exit(124);
}, timeoutMs);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (signal) {
    console.error(`[e2e] Playwright exited by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
