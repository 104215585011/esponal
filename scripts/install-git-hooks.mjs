#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";

if (!fs.existsSync(".git") || !fs.existsSync(".githooks/pre-commit")) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "ignore"
  });
} catch {
  process.exit(0);
}
