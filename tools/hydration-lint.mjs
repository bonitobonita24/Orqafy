#!/usr/bin/env node
// Checks for common SSR hydration mismatch patterns in Next.js components

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const warnings = [];

const HYDRATION_PATTERNS = [
  {
    pattern: /typeof\s+window\s*[!=]==?\s*["']undefined["']/,
    message: "typeof window check may cause hydration mismatch — use useEffect",
  },
  {
    pattern: /new\s+Date\(\)/,
    message:
      "new Date() in render body differs server/client — use useEffect or pass from server",
  },
  {
    pattern: /Math\.random\(\)/,
    message:
      "Math.random() in render body produces different server/client values",
  },
  {
    pattern: /localStorage\./,
    message: "localStorage access in render body — move to useEffect",
  },
  {
    pattern: /sessionStorage\./,
    message: "sessionStorage access in render body — move to useEffect",
  },
  {
    pattern: /navigator\./,
    message: "navigator access in render body — move to useEffect",
  },
];

function scanDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === ".turbo")
      continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if ([".tsx", ".jsx"].includes(extname(fullPath))) {
      const content = readFileSync(fullPath, "utf-8");
      for (const { pattern, message } of HYDRATION_PATTERNS) {
        if (pattern.test(content)) {
          const relPath = fullPath.replace(ROOT + "/", "");
          warnings.push(`${relPath}: ${message}`);
        }
      }
    }
  }
}

const appDirs = [resolve(ROOT, "apps"), resolve(ROOT, "packages/ui")];

for (const dir of appDirs) {
  scanDir(dir);
}

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} potential hydration issue(s):`);
  for (const w of warnings) {
    console.warn(`   - ${w}`);
  }
  process.exit(0);
}

console.log("✅ No hydration mismatch patterns detected");
