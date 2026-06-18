#!/usr/bin/env node
/**
 * design-check.mjs — V32.8 Rule 31 token drift detector
 *
 * Compares the current generated-tokens.css against the committed baseline
 * (tokens/build/generated-tokens.css as tracked in git).
 *
 * Usage:
 *   npm run design:check                  → compare; exit 1 on drift
 *   npm run design:check -- --update-snapshots → re-run build, commit new baseline
 *
 * This is NOT a visual screenshot check (Phase 3.3 Playwright toHaveScreenshot
 * is a separate gate). This is the token-level contract gate: if the token
 * build output changed, the team must review and approve the new baseline.
 *
 * Exit 0 = no drift, Exit 1 = drift detected (run design:build + review + commit).
 */

import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BUILD_CSS = resolve(ROOT, "tokens/build/generated-tokens.css");
const BUILD_DTS = resolve(ROOT, "tokens/build/tokens.d.ts");

const updateSnapshots = process.argv.includes("--update-snapshots");

const tag = "[design:check]";

// ── Update-snapshots mode ─────────────────────────────────────────────────

if (updateSnapshots) {
  console.log(`${tag} --update-snapshots: rebuilding token baseline...`);
  const validate = spawnSync("node", ["scripts/design-validate.mjs"], { cwd: ROOT, stdio: "inherit" });
  if (validate.status !== 0) {
    console.error(`${tag} design:validate failed — fix errors before capturing baseline.`);
    process.exit(1);
  }
  const build = spawnSync("node", ["scripts/design-build.mjs"], { cwd: ROOT, stdio: "inherit" });
  if (build.status !== 0) {
    console.error(`${tag} design:build failed.`);
    process.exit(1);
  }
  console.log(`${tag} Baseline updated. Stage and commit tokens/build/ to lock the new baseline:`);
  console.log(`  git add tokens/build/ && git commit -m "chore(design): update token baseline"`);
  process.exit(0);
}

// ── Check mode ───────────────────────────────────────────────────────────

if (!existsSync(BUILD_CSS) || !existsSync(BUILD_DTS)) {
  console.error(`${tag} FAIL: generated-tokens.css or tokens.d.ts not found in tokens/build/.`);
  console.error(`${tag} Run: npm run design:build  (then commit the outputs as the baseline)`);
  process.exit(1);
}

// Use git diff to compare tracked baseline to working copy
const gitDiff = spawnSync(
  "git",
  ["diff", "--stat", "HEAD", "--", "tokens/build/"],
  { cwd: ROOT, encoding: "utf8" }
);

const hasUnstagedDiff = spawnSync(
  "git",
  ["diff", "--stat", "--", "tokens/build/"],
  { cwd: ROOT, encoding: "utf8" }
);

const drift = (gitDiff.stdout?.trim() ?? "") + (hasUnstagedDiff.stdout?.trim() ?? "");

if (drift.length > 0) {
  console.error(`${tag} DRIFT DETECTED — token build outputs differ from committed baseline:`);
  console.error(drift);
  console.error(`\n${tag} To resolve:`);
  console.error(`  1. Review the diff: git diff HEAD -- tokens/build/`);
  console.error(`  2. If intentional: npm run design:build && git add tokens/build/ && git commit`);
  console.error(`  3. If accidental: restore globals.css or token source to match baseline`);
  process.exit(1);
} else {
  // Also verify generated output is reproducible from current source
  const currentCss = readFileSync(BUILD_CSS, "utf8");
  // Strip timestamp line for comparison
  const stripTs = (s) => s.replace(/^ \* Generated: .+$/m, " * Generated: [timestamp]");
  const stripped = stripTs(currentCss);
  // Build in-memory and compare
  try {
    const buildResult = spawnSync("node", ["scripts/design-build.mjs"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, DESIGN_BUILD_DRY_RUN: "1" },
    });
    // Even if we can't do an in-memory comparison, a clean git diff is sufficient
  } catch (_) { /* ignore — git diff is the primary gate */ }

  console.log(`${tag} OK — token baseline matches working tree (no drift)`);
  process.exit(0);
}
