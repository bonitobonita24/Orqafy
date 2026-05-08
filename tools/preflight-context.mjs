#!/usr/bin/env node
// Anti-thrashing pre-flight check (V31 in-place addition).
//
// Purpose: deterministic context-budget computation before starting any
// Phase 4 Part, Phase 7 Feature Update, or Phase 8 Batch. Replaces agent
// mental math with a hard pre-flight gate.
//
// Thresholds match CLAUDE.md anti-thrashing rule:
//   SAFE        ≤80,000 tokens   — proceed silently
//   AT_RISK     80K–100K          — warning + acknowledgment required (exit 0)
//   MUST_SPLIT  >100,000          — hard stop (exit 1)
//
// Run `node tools/preflight-context.mjs --help` for usage.

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit, stdout, stderr } from "node:process";

// ── Constants ────────────────────────────────────────────────────────────
// 3.8 chars/token is calibrated for TS/TSX/markdown — Anthropic tokenizer
// averages ~3.5–4.0 chars per token on this codebase's content mix.
const CHARS_PER_TOKEN = 3.8;
const SAFE_CEILING = 80_000;
const RISK_CEILING = 100_000;
const CONVERSATION_OVERHEAD = 15_000;
const NEW_FILE_AVG_TOKENS = 2_000;

// Fixed overhead per phase profile = CLAUDE.md (~5K) + active rule files +
// 9 governance docs (~10K) + STATE.md + lessons.md priority loads.
const PHASE_OVERHEAD = {
  "phase-4-part": 22_000,
  "phase-7-feature": 24_000,
  "phase-8-batch": 22_000,
  generic: 18_000,
};

const VERDICTS = {
  SAFE: { icon: "✅", exit: 0 },
  AT_RISK: { icon: "⚠", exit: 0 },
  MUST_SPLIT: { icon: "🔴", exit: 1 },
};

const USAGE = `
preflight-context — anti-thrashing pre-flight check (V31)

Usage:
  pnpm preflight --task "<name>" [--read "<paths>"] [--new <count>] [--phase <type>] [--json]

Required:
  --task "<name>"     Descriptive label for this scope check
                      (e.g. "Phase 8 Batch 3 Item 1: Module 4 Production")

Optional:
  --read "<paths>"    Comma-separated list of files the agent will read.
                      Pass exact paths — globs not supported.
  --new <count>       Number of new files the agent will create. Default: 0
  --phase <type>      One of: phase-4-part | phase-7-feature | phase-8-batch | generic
                      Default: generic
  --json              Output JSON instead of human-readable text
  --self-test         Run internal verdict-logic tests (CI / smoke check)
  --help, -h          Show this help

Exit codes:
  0   SAFE (≤80K) or AT_RISK (80–100K, warning)
  1   MUST_SPLIT (>100K, hard stop — must sub-divide)
  2   Usage error (missing --task, etc.)

Examples:
  # Small scope — likely SAFE
  pnpm preflight --task "Add field to existing model" \\
    --phase phase-7-feature \\
    --read "apps/web/src/server/trpc/routers/banking.ts" \\
    --new 0

  # Phase 8 batch with 3 routers + tests
  pnpm preflight --task "Phase 8 Batch 3 Item 1" \\
    --phase phase-8-batch \\
    --read "apps/web/src/server/trpc/routers/_app.ts,apps/web/src/server/trpc/routers/banking.ts" \\
    --new 4
`.trim();

// ── Argument parsing ─────────────────────────────────────────────────────

function parseArgs(rawArgs) {
  const args = {
    task: "",
    read: [],
    new: 0,
    phase: "generic",
    json: false,
    selfTest: false,
    help: false,
  };
  for (let i = 2; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    switch (arg) {
      case "--task":
        args.task = rawArgs[++i] ?? "";
        break;
      case "--read":
        args.read = (rawArgs[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--new":
        args.new = Number.parseInt(rawArgs[++i] ?? "0", 10) || 0;
        break;
      case "--phase":
        args.phase = rawArgs[++i] ?? "generic";
        break;
      case "--json":
        args.json = true;
        break;
      case "--self-test":
        args.selfTest = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        stderr.write(`ERROR: unknown argument: ${arg}\n`);
        exit(2);
    }
  }
  return args;
}

// ── Token estimation ─────────────────────────────────────────────────────

function estimateFileTokens(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    return { path, tokens: 0, error: "missing" };
  }
  try {
    const stat = statSync(abs);
    if (!stat.isFile()) {
      return { path, tokens: 0, error: "not-a-file" };
    }
    const tokens = Math.ceil(stat.size / CHARS_PER_TOKEN);
    return { path, tokens, bytes: stat.size };
  } catch (err) {
    return { path, tokens: 0, error: err.message };
  }
}

function compute({ phase, read, newFiles }) {
  const fixedOverhead = PHASE_OVERHEAD[phase] ?? PHASE_OVERHEAD.generic;
  const readEstimates = read.map(estimateFileTokens);
  const readTokens = readEstimates.reduce((sum, r) => sum + r.tokens, 0);
  const newTokens = newFiles * NEW_FILE_AVG_TOKENS;
  const totalTokens = fixedOverhead + readTokens + newTokens + CONVERSATION_OVERHEAD;

  let verdict;
  if (totalTokens > RISK_CEILING) verdict = "MUST_SPLIT";
  else if (totalTokens > SAFE_CEILING) verdict = "AT_RISK";
  else verdict = "SAFE";

  return {
    fixedOverhead,
    readEstimates,
    readTokens,
    newFiles,
    newTokens,
    conversationOverhead: CONVERSATION_OVERHEAD,
    totalTokens,
    verdict,
  };
}

// ── Output ───────────────────────────────────────────────────────────────

function pad(n) {
  return n.toLocaleString("en-US").padStart(8);
}

function printJson(args, result) {
  stdout.write(
    JSON.stringify(
      {
        task: args.task,
        phase: args.phase,
        breakdown: result,
        thresholds: { safe: SAFE_CEILING, risk: RISK_CEILING },
        verdict: result.verdict,
        exitCode: VERDICTS[result.verdict].exit,
      },
      null,
      2,
    ) + "\n",
  );
}

function printHuman(args, result) {
  const v = VERDICTS[result.verdict];
  const lines = [
    "",
    `PREFLIGHT — ${args.task}`,
    `Phase profile: ${args.phase}`,
    "",
    "Token Budget Analysis:",
    `  Fixed overhead (governance + rules):  ~${pad(result.fixedOverhead)} tokens`,
    `  Read files (${result.readEstimates.length}):${" ".repeat(Math.max(1, 30 - 14 - String(result.readEstimates.length).length))}~${pad(result.readTokens)} tokens`,
  ];
  for (const r of result.readEstimates) {
    const note = r.error ? ` (${r.error})` : "";
    lines.push(
      `    ${r.path}${note} — ~${r.tokens.toLocaleString("en-US")}`,
    );
  }
  lines.push(
    `  New files (${result.newFiles} × ~2K each):${" ".repeat(Math.max(1, 30 - 18 - String(result.newFiles).length))}~${pad(result.newTokens)} tokens`,
    `  Conversation overhead:                ~${pad(result.conversationOverhead)} tokens`,
    `  ─────────────────────────────────────────────────`,
    `  ESTIMATED TOTAL:                      ~${pad(result.totalTokens)} tokens`,
    "",
    `  SAFE:        ≤${SAFE_CEILING.toLocaleString("en-US")}`,
    `  AT_RISK:     ${SAFE_CEILING.toLocaleString("en-US")}–${RISK_CEILING.toLocaleString("en-US")}`,
    `  MUST_SPLIT:  >${RISK_CEILING.toLocaleString("en-US")}`,
    "",
    `  VERDICT: ${v.icon} ${result.verdict}`,
  );

  if (result.verdict === "MUST_SPLIT") {
    lines.push(
      "",
      "  🔴 MUST_SPLIT — exceeds 100K hard ceiling.",
      "  Pre-flight gate FAILED. Do NOT write any code.",
      "",
      "  Required action:",
      "    1. Sub-divide the task by module, feature, or layer",
      "    2. Re-run pnpm preflight on each sub-task",
      "    3. Each sub-task must verdict SAFE or AT_RISK before proceeding",
      "",
      "  Reduction levers (in order of impact):",
      "    - Read PRODUCT.md SECTIONS only, never full file (saves ~20K)",
      "    - Use codebase_search instead of opening directories",
      "    - Drop test files from --read (write fresh, don't reference)",
      "    - Split --new files into separate sub-tasks",
    );
  } else if (result.verdict === "AT_RISK") {
    lines.push(
      "",
      "  ⚠ AT_RISK — within 80K–100K window.",
      "  Proceed only with explicit acknowledgment.",
      "",
      "  ACKNOWLEDGMENT REQUIRED — output this in your next message:",
      `    "I acknowledge ${args.task} is AT_RISK`,
      `     (~${result.totalTokens.toLocaleString("en-US")} tokens). I will read PRODUCT.md`,
      "     sections only, use codebase_search, and run /clear if",
      '     context starts thrashing."',
    );
  }
  lines.push("");
  stdout.write(lines.join("\n") + "\n");
}

// ── Self-test ────────────────────────────────────────────────────────────

function selfTest() {
  const cases = [
    {
      name: "SAFE: minimal scope",
      input: { phase: "generic", read: [], newFiles: 0 },
      expected: "SAFE",
      expectedRange: [33_000, 33_000],
    },
    {
      name: "SAFE: phase-7 with 2 small reads + 3 new files",
      input: {
        phase: "phase-7-feature",
        read: ["package.json"],
        newFiles: 3,
      },
      expected: "SAFE",
    },
    {
      name: "AT_RISK: synthetic ~85K total",
      input: { phase: "phase-8-batch", read: [], newFiles: 24 },
      expected: "AT_RISK",
      expectedRange: [85_000, 85_000],
    },
    {
      name: "MUST_SPLIT: synthetic ~125K total",
      input: { phase: "phase-8-batch", read: [], newFiles: 44 },
      expected: "MUST_SPLIT",
      expectedRange: [125_000, 125_000],
    },
    {
      name: "MUST_SPLIT: phase-4-part edge case at 100,001 boundary",
      // 22,000 fixed + 15,000 conv + 31.5 × 2,000 new = 100,000 (SAFE edge)
      // Add 1 more new file → 100K + 2K = 102K → MUST_SPLIT
      input: { phase: "phase-4-part", read: [], newFiles: 32 },
      expected: "MUST_SPLIT",
    },
    {
      name: "AT_RISK: phase-4-part at 99,000 (just under MUST_SPLIT)",
      // 22,000 + 15,000 + 31 × 2,000 = 99,000
      input: { phase: "phase-4-part", read: [], newFiles: 31 },
      expected: "AT_RISK",
    },
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const tc of cases) {
    const result = compute(tc.input);
    const verdictOk = result.verdict === tc.expected;
    const rangeOk = tc.expectedRange
      ? result.totalTokens >= tc.expectedRange[0] &&
        result.totalTokens <= tc.expectedRange[1]
      : true;
    if (verdictOk && rangeOk) {
      passed++;
      stdout.write(`  ✅ ${tc.name} (verdict=${result.verdict}, tokens=${result.totalTokens})\n`);
    } else {
      failed++;
      failures.push({
        name: tc.name,
        expected: tc.expected,
        got: result.verdict,
        tokens: result.totalTokens,
      });
      stdout.write(
        `  ❌ ${tc.name} — expected ${tc.expected}, got ${result.verdict} (tokens=${result.totalTokens})\n`,
      );
    }
  }

  stdout.write(`\nSelf-test: ${passed}/${cases.length} passed`);
  if (failed > 0) {
    stdout.write(`, ${failed} failed\n`);
    for (const f of failures) {
      stdout.write(`  - ${f.name}: expected ${f.expected}, got ${f.got}\n`);
    }
    exit(1);
  }
  stdout.write("\n");
  exit(0);
}

// ── Main ─────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(argv);
  if (args.help) {
    stdout.write(USAGE + "\n");
    exit(0);
  }
  if (args.selfTest) {
    stdout.write("preflight-context self-test:\n");
    selfTest();
    return;
  }
  if (!args.task) {
    stderr.write("ERROR: --task is required. Run with --help for usage.\n");
    exit(2);
  }
  const result = compute({
    phase: args.phase,
    read: args.read,
    newFiles: args.new,
  });
  if (args.json) printJson(args, result);
  else printHuman(args, result);
  exit(VERDICTS[result.verdict].exit);
}

main();
