#!/usr/bin/env node
// Adapted from os-factory/har (Apache-2.0) — stage registry + runner.
// =============================================================================
// run-stages.mjs — stage registry + runner (HAR harvest M2)
//
// Reads a JSON stage registry (scripts/stages.json in a deployed app;
// specdrivenprompt/stages.json in this framework repo) and runs each stage's
// shell command, tallying pass/fail/skip. Mirrors the house style of
// validate-findings.mjs (#45) / audit-scope.mjs (#42) / review-scope.mjs (#40):
// zero runtime deps (node:* stdlib only), a `--self-test` embedded-fixture
// regression that is the real failable gate, deterministic JSON output.
//
// DESIGN LAW 1 (QUICK stops, FULL never does). `--quick` (default) runs only
//   tier="quick" stages, IN ORDER, and stops at the first BLOCKING failure —
//   a fast pre-commit-shaped gate. `--full` runs every stage regardless of
//   tier, never stopping early — a complete-picture report.
// DESIGN LAW 2 (missing tool = skipped, never failed). If a stage's target
//   script file does not exist, or the command exits 127 ("command not
//   found"), the stage is recorded `skipped:true` — same graceful-degrade
//   posture as lint-deploy.sh's missing-scanner handling. A skip never flips
//   the overall verdict.
// DESIGN LAW 3 (overall status = blocking stages only). `status` is "fail"
//   iff at least one BLOCKING stage actually failed (ran, didn't skip, exited
//   non-zero). A failed non-blocking stage is recorded but never fails the run.
//
// Registry authority: stages.json (co-located). Tree-hash binding: this
// runner's JSON output is what verify-record.sh's `write` subcommand gates a
// validation record on (`RUN_STAGES_CMD` defaults to
// `node scripts/run-stages.mjs --full`).
// =============================================================================

const FRAMEWORK_VERSION = "V32.65";
const DEFAULT_REGISTRY_CANDIDATES = ["scripts/stages.json", "./stages.json"];
const OUTPUT_PATH = "test-artifacts/stages/last.json";

// ---------------------------------------------------------------------------
// loadRegistry — read + parse a stage registry file. Pure w.r.t. its single
// filesystem read. Throws a descriptive Error on missing/invalid JSON/bad
// shape so the CLI can report it cleanly; never silently returns garbage.
// @param {string} path
// @param {{readFileSync: Function, existsSync: Function}} fs
// @returns {{version:number, stages:Array<object>}}
// ---------------------------------------------------------------------------
function loadRegistry(path, fs) {
  if (!fs.existsSync(path)) {
    throw new Error(`registry not found: ${path}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`could not parse "${path}" as JSON: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.stages)) {
    throw new Error(`"${path}" is not a valid stage registry (expected { stages: [...] })`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// selectStages — pure selection by mode. "quick" = tier==="quick" only (in
// registry order); "full" = every stage (in registry order).
// ---------------------------------------------------------------------------
function selectStages(stages, mode) {
  const list = Array.isArray(stages) ? stages : [];
  if (mode === "full") return [...list];
  return list.filter((s) => s && s.tier === "quick");
}

// ---------------------------------------------------------------------------
// runStage — execute one stage's cmd via `sh -c`, classify the result.
// A stage whose command's first whitespace-delimited "script-looking" token
// (a relative path containing a "/" and an extension) does not exist on disk
// is treated as skipped WITHOUT even spawning a process (fast, deterministic,
// no partial side effects from a doomed command). Otherwise it is spawned and
// classified: exit 127 ("command not found") is ALSO a skip — the tool itself
// (not just the target script) is missing from PATH.
// @param {object} stage
// @param {{spawnSync: Function, existsSync: Function}} deps
// @returns {{id,tier,blocking,pass,skipped,exit,ms}}
// ---------------------------------------------------------------------------
function runStage(stage, deps) {
  const id = stage.id;
  const tier = stage.tier;
  const blocking = Boolean(stage.blocking);

  const scriptToken = String(stage.cmd || "")
    .split(/\s+/)
    .find((tok) => tok.includes("/") && !tok.startsWith("-"));

  if (scriptToken && !deps.existsSync(scriptToken)) {
    return { id, tier, blocking, pass: true, skipped: true, exit: null, ms: 0 };
  }

  const start = Date.now();
  const result = deps.spawnSync("sh", ["-c", stage.cmd], { encoding: "utf8" });
  const ms = Date.now() - start;

  const exit = typeof result.status === "number" ? result.status : result.signal ? -1 : null;

  if (exit === 127) {
    return { id, tier, blocking, pass: true, skipped: true, exit, ms };
  }

  return { id, tier, blocking, pass: exit === 0, skipped: false, exit, ms };
}

// ---------------------------------------------------------------------------
// runStages — the PURE orchestration core. Runs `selected` stages via
// `runDeps.runStage` (injectable for tests), stopping early in "quick" mode
// at the first stage that actually failed (not skipped) AND is blocking.
// Returns the stages array actually executed (in order) plus the derived
// overall status. No I/O beyond the injected runStage/now.
// @param {Array<object>} selected
// @param {string} mode  "quick" | "full"
// @param {{runStage: Function}} runDeps
// ---------------------------------------------------------------------------
function runStages(selected, mode, runDeps) {
  const results = [];
  for (const stage of selected) {
    const r = runDeps.runStage(stage);
    results.push(r);
    if (mode === "quick" && r.blocking && !r.skipped && !r.pass) {
      break;
    }
  }
  const status = results.some((r) => r.blocking && !r.skipped && !r.pass) ? "fail" : "pass";
  return { status, stages: results };
}

// ---------------------------------------------------------------------------
// buildSummary — assemble the final JSON output object (adds treeHash +
// timing + mode; pure given its inputs — the CLI supplies startedAt/totalMs/
// treeHash from the outside so this stays testable without real timers).
// ---------------------------------------------------------------------------
function buildSummary({ status, stages, mode, treeHash, startedAt, totalMs }) {
  return { status, mode, treeHash: treeHash || "", startedAt, totalMs, stages };
}

// ---------------------------------------------------------------------------
// renderSummaryLines — one human-readable PASS/FAIL/SKIP line per stage, for
// stderr. Pure string formatting.
// ---------------------------------------------------------------------------
function renderSummaryLines(summary) {
  const lines = [];
  for (const s of summary.stages) {
    const label = s.skipped ? "SKIP" : s.pass ? "PASS" : "FAIL";
    const blockTag = s.blocking ? "blocking" : "advisory";
    lines.push(`  [${label}] ${s.id} (${s.tier}/${blockTag}) ${s.ms}ms`);
  }
  lines.push(`\n${summary.status === "pass" ? "PASS" : "FAIL"} — mode=${summary.mode} totalMs=${summary.totalMs}`);
  return lines.join("\n");
}

export { loadRegistry, selectStages, runStage, runStages, buildSummary, renderSummaryLines };

// =============================================================================
// SELF-TEST (POW-24 pattern). Builds a temp fixture registry with tiny real
// commands (true/false/exit 127/sleep) under a temp dir, feeds it through the
// SAME real functions the CLI uses, and asserts the behavioral contract.
// Prints one line per assertion, then `PASS — N/N`; exits 0 on all-pass, 1 on
// ANY regression.
// =============================================================================

const _isTTY = process.stdout.isTTY;
const _RST = _isTTY ? "\x1b[0m" : "";
const _RED = _isTTY ? "\x1b[31m" : "";
const _GRN = _isTTY ? "\x1b[32m" : "";
const _CYN = _isTTY ? "\x1b[36m" : "";
const _PASS = `${_GRN}PASS${_RST}`;
const _FAIL = `${_RED}FAIL${_RST}`;

async function selfTest() {
  const { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } = await import("node:fs");
  const { spawnSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");

  let failures = 0;
  const results = [];
  const record = (label, ok) => {
    results.push({ label, ok });
    if (!ok) failures += 1;
  };

  const tmp = mkdtempSync(path.join(tmpdir(), "run-stages-self-test-"));
  try {
    // --- fixture registry: mixes quick/full, blocking/non-blocking, and a
    // deliberately-missing script to exercise the skip path. -------------------
    const trueScript = path.join(tmp, "ok.sh");
    writeFileSync(trueScript, "#!/usr/bin/env sh\nexit 0\n", { mode: 0o755 });
    const falseScript = path.join(tmp, "bad.sh");
    writeFileSync(falseScript, "#!/usr/bin/env sh\nexit 1\n", { mode: 0o755 });
    const slowScript = path.join(tmp, "slow.sh");
    writeFileSync(slowScript, "#!/usr/bin/env sh\nsleep 0\nexit 0\n", { mode: 0o755 });
    const missingScript = path.join(tmp, "missing.sh");

    const registry = {
      version: 1,
      stages: [
        { id: "a-quick-blocking-pass", cmd: `sh ${trueScript}`, tier: "quick", blocking: true },
        { id: "b-quick-blocking-fail", cmd: `sh ${falseScript}`, tier: "quick", blocking: true },
        { id: "c-quick-after-fail", cmd: `sh ${trueScript}`, tier: "quick", blocking: false },
        { id: "d-full-nonblocking-fail", cmd: `sh ${falseScript}`, tier: "full", blocking: false },
        { id: "e-full-missing-script", cmd: `sh ${missingScript}`, tier: "full", blocking: true },
        { id: "f-full-cmd-not-found", cmd: "this-binary-does-not-exist-xyz", tier: "full", blocking: false },
        { id: "g-full-slow-pass", cmd: `sh ${slowScript}`, tier: "full", blocking: false },
      ],
    };
    const registryPath = path.join(tmp, "stages.json");
    writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const fsDeps = { readFileSync, existsSync };
    const loaded = loadRegistry(registryPath, fsDeps);
    record("loadRegistry parses a valid registry (7 stages)", loaded.stages.length === 7);

    const runDeps = { spawnSync, existsSync };

    // --- 1. QUICK mode selects only tier=quick, stops at first blocking fail ---
    const quickSelected = selectStages(loaded.stages, "quick");
    record(
      "quick selection: only tier=quick stages (a,b,c)",
      quickSelected.length === 3 && quickSelected.every((s) => s.tier === "quick"),
    );
    const quickRun = runStages(quickSelected, "quick", { runStage: (s) => runStage(s, runDeps) });
    record(
      "quick mode: stops at first blocking failure (b) — c never runs",
      quickRun.stages.length === 2 &&
        quickRun.stages[0].id === "a-quick-blocking-pass" &&
        quickRun.stages[0].pass === true &&
        quickRun.stages[1].id === "b-quick-blocking-fail" &&
        quickRun.stages[1].pass === false,
    );
    record("quick mode: overall status is fail (blocking stage failed)", quickRun.status === "fail");

    // --- 2. FULL mode runs every stage regardless of failures ------------------
    const fullSelected = selectStages(loaded.stages, "full");
    record("full selection: every stage (7)", fullSelected.length === 7);
    const fullRun = runStages(fullSelected, "full", { runStage: (s) => runStage(s, runDeps) });
    record("full mode: runs ALL 7 stages even after failures", fullRun.stages.length === 7);

    // --- 3. missing script file → skipped, never failed ------------------------
    const eStage = fullRun.stages.find((s) => s.id === "e-full-missing-script");
    record(
      "missing script file → skipped:true, pass:true (never fails the run)",
      eStage && eStage.skipped === true && eStage.pass === true,
    );

    // --- 4. command not found (exit 127) → skipped, never failed ---------------
    const fStage = fullRun.stages.find((s) => s.id === "f-full-cmd-not-found");
    record(
      "exit 127 (command not found) → skipped:true, pass:true",
      fStage && fStage.skipped === true && fStage.pass === true && fStage.exit === 127,
    );

    // --- 5. a non-blocking failure never flips the overall verdict -------------
    const dStage = fullRun.stages.find((s) => s.id === "d-full-nonblocking-fail");
    record(
      "full mode: a non-blocking failed stage is recorded pass:false but...",
      dStage && dStage.pass === false && dStage.skipped === false,
    );
    const statusCheck = runStages(
      [{ id: "x", tier: "full", blocking: false, cmd: "true" }],
      "full",
      { runStage: () => ({ id: "x", tier: "full", blocking: false, pass: false, skipped: false, exit: 1, ms: 1 }) },
    );
    record(
      "...overall status stays pass when only non-blocking stages fail",
      statusCheck.status === "pass",
    );

    // --- 6. a BLOCKING failure anywhere flips status to fail -------------------
    const blockingFailCheck = runStages(
      [{ id: "y", tier: "full", blocking: true, cmd: "false" }],
      "full",
      { runStage: () => ({ id: "y", tier: "full", blocking: true, pass: false, skipped: false, exit: 1, ms: 1 }) },
    );
    record("a real blocking failure (not skipped) flips status to fail", blockingFailCheck.status === "fail");

    // --- 7. a skipped blocking stage does NOT flip status to fail --------------
    const blockingSkipCheck = runStages(
      [{ id: "z", tier: "full", blocking: true, cmd: "missing" }],
      "full",
      { runStage: () => ({ id: "z", tier: "full", blocking: true, pass: true, skipped: true, exit: null, ms: 0 }) },
    );
    record("a skipped blocking stage does NOT flip status to fail", blockingSkipCheck.status === "pass");

    // --- 8. buildSummary shape + JSON-serializable ------------------------------
    const summary = buildSummary({
      status: fullRun.status,
      stages: fullRun.stages,
      mode: "full",
      treeHash: "deadbeef",
      startedAt: "2026-01-01T00:00:00.000Z",
      totalMs: 42,
    });
    let serialized = null;
    try {
      serialized = JSON.parse(JSON.stringify(summary));
    } catch {
      serialized = null;
    }
    record(
      "buildSummary output has the required JSON keys and is serializable",
      serialized !== null &&
        "status" in serialized &&
        "mode" in serialized &&
        "treeHash" in serialized &&
        "startedAt" in serialized &&
        "totalMs" in serialized &&
        Array.isArray(serialized.stages),
    );

    // --- 9. loadRegistry rejects a missing file / bad shape --------------------
    let threwMissing = false;
    try {
      loadRegistry(path.join(tmp, "nope.json"), fsDeps);
    } catch {
      threwMissing = true;
    }
    record("loadRegistry throws on a missing registry file", threwMissing);

    const badShapePath = path.join(tmp, "bad-shape.json");
    writeFileSync(badShapePath, JSON.stringify({ notStages: [] }));
    let threwBadShape = false;
    try {
      loadRegistry(badShapePath, fsDeps);
    } catch {
      threwBadShape = true;
    }
    record("loadRegistry throws on a registry missing a stages array", threwBadShape);

    // --- 10. renderSummaryLines produces one line per stage + a verdict line ---
    const rendered = renderSummaryLines(summary);
    record(
      "renderSummaryLines: one PASS/FAIL/SKIP line per stage + a verdict line",
      fullRun.stages.every((s) => rendered.includes(s.id)) && /PASS|FAIL/.test(rendered.split("\n").pop()),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n${_CYN}=== run-stages.mjs self-test ===${_RST}`);
  for (const { label, ok } of results) {
    console.log(`  [${ok ? _PASS : _FAIL}] ${label}`);
  }
  const overall = failures === 0;
  console.log(`\n${overall ? _PASS : _FAIL} — ${results.length - failures}/${results.length} assertions passed\n`);
  process.exit(overall ? 0 : 1);
}

const HELP = `run-stages.mjs — stage registry + runner (HAR harvest M2)

Reads a JSON stage registry and runs each stage's command, tallying
pass/fail/skip. Quick mode stops at the first blocking failure; full mode
runs every stage. A missing target script, or a command exiting 127, is
recorded as SKIPPED — never a failure.

Usage:
  node scripts/run-stages.mjs                       Quick mode (default), using scripts/stages.json
  node scripts/run-stages.mjs --quick                Same, explicit
  node scripts/run-stages.mjs --full                 Run every stage regardless of tier
  node scripts/run-stages.mjs --registry <path>      Use a different registry file
  node scripts/run-stages.mjs --json-only            Suppress the human summary on stderr
  node scripts/run-stages.mjs --self-test            Run embedded-fixture regression, print PASS N/N
  node scripts/run-stages.mjs --help                 This message

Output:
  One JSON object on stdout: {status, mode, treeHash, startedAt, totalMs, stages}.
  Also written to test-artifacts/stages/last.json.

Exit codes:
  0  status "pass" / self-test PASS
  1  status "fail" (a blocking stage actually failed) / self-test found a regression`;

// ---------------------------------------------------------------------------
// CLI entry.
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }
  if (cliArgs.includes("--self-test")) {
    await selfTest(); // calls process.exit() itself
  }

  const { readFileSync, existsSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { spawnSync } = await import("node:child_process");

  const args = cliArgs;
  const argVal = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };
  const mode = args.includes("--full") ? "full" : "quick";
  const jsonOnly = args.includes("--json-only");

  let registryPath = argVal("--registry");
  if (!registryPath) {
    registryPath = DEFAULT_REGISTRY_CANDIDATES.find((p) => existsSync(p)) || DEFAULT_REGISTRY_CANDIDATES[0];
  }

  const fsDeps = { readFileSync, existsSync };
  let registry;
  try {
    registry = loadRegistry(registryPath, fsDeps);
  } catch (err) {
    console.error(`run-stages: ${err.message}`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const selected = selectStages(registry.stages, mode);
  const runDeps = { spawnSync, existsSync };
  const { status, stages } = runStages(selected, mode, { runStage: (s) => runStage(s, runDeps) });

  const totalMs = Date.now() - t0;

  let treeHash = "";
  try {
    const verifyRecordCandidates = ["scripts/verify-record.sh", "specdrivenprompt/verify-record.sh"];
    const verifyRecordPath = verifyRecordCandidates.find((p) => existsSync(p));
    if (verifyRecordPath) {
      const hashResult = spawnSync("bash", [verifyRecordPath, "hash", "--worktree"], { encoding: "utf8" });
      if (hashResult.status === 0 && hashResult.stdout) {
        treeHash = hashResult.stdout.trim();
      }
    }
  } catch {
    treeHash = "";
  }

  const summary = buildSummary({ status, stages, mode, treeHash, startedAt, totalMs });

  try {
    mkdirSync("test-artifacts/stages", { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error(`run-stages: could not write ${OUTPUT_PATH}:`, err.message);
  }

  if (!jsonOnly) {
    console.error(renderSummaryLines(summary));
  }
  console.log(JSON.stringify(summary));

  process.exit(status === "pass" ? 0 : 1);
}
