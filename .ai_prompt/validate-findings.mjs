// validate-findings.mjs — machine-checkable audit-finding contract validator
// (V32.60, deliverable #45). Sibling of audit-scope.mjs (#42) / review-scope.mjs
// (#40). Zero runtime deps (node:* stdlib only).
//
// Adapted (reference-and-adapt, MIT) from cloudflare/security-audit-skill's
// report-schema.json + its dependency-free JSON-schema validators. It validates
// an audit-findings report (findings.json) against report-schema.json (#45): the
// four taxonomy axes — severity, confidence, dataFlowRole, preconditions — plus
// mandatory non-empty evidence. Wired into Rule 38 `.ai_prompt/audit.md` §6 as
// the standard output contract for a `full audit check` / audit-app run.
//
// DESIGN LAW 1 (ADVISORY, never blocks). The default path validates a report,
//   writes + prints a validation manifest, and ALWAYS exit(0). A contract
//   violation is reported, never fatal. `--strict` is an explicit per-app OPT-IN
//   that exits non-zero on a violation (same posture as audit-app.sh's
//   `audit.tier2.enforce` gate); `--self-test` is the failable mechanical gate.
// DESIGN LAW 2 (SHAPE not TRUTH). This tool checks that a finding is well-FORMED
//   (required fields present, enums valid, evidence non-empty) — it does NOT and
//   cannot judge whether a finding is CORRECT. The judgment stays in the 🧠
//   audit swarm (adversarial-disproof); this validator only enforces the
//   contract so findings are comparable, sortable, and machine-checkable.
// DESIGN LAW 3 (FLOOR-not-ceiling). The contract standardizes a finding's shape;
//   it never caps what an audit may report. Extra fields are allowed.
//
// Contract authority: report-schema.json (deliverable #45, co-located).
// Reporting authority: ~/.claude/library/full-audit-check-trigger.md §5
//   (coverage-ledger + adversarial-disproof + target-neutral reporting) +
//   `.ai_prompt/audit.md` §6 (severity/triage buckets).

const FRAMEWORK_VERSION = "V32.60";

// ---------------------------------------------------------------------------
// Contract constants — the SINGLE source of truth for the validator. These MUST
// stay in lockstep with report-schema.json's enums/required-fields; the paired
// test (validate-findings.test.mjs) reads report-schema.json and asserts parity,
// so drift between this file and the JSON contract fails the mechanical gate.
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = "1.0";
const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "info"];
const CONFIDENCE_LEVELS = ["confirmed", "plausible"];
const DATA_FLOW_ROLES = ["source", "sink", "sanitizer", "passthrough", "none"];
const REQUIRED_REPORT_FIELDS = ["schemaVersion", "generator", "target", "findings"];
const REQUIRED_FINDING_FIELDS = [
  "id",
  "title",
  "severity",
  "confidence",
  "dataFlowRole",
  "preconditions",
  "evidence",
];

// Impact ordering — real-defect > drift > advisory > nit (full-audit severity).
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ---------------------------------------------------------------------------
// Empty summary shape — returned even for a non-object / unparseable report so
// callers can always read summary.* without a guard.
// ---------------------------------------------------------------------------

function emptySummary() {
  return { findings: 0, confirmed: 0, plausible: 0, bySeverity: {} };
}

// ---------------------------------------------------------------------------
// validateReport — the PURE contract check. Returns hard `errors` (contract
// violations), soft `warnings`, and a derived `summary`. Never throws; never
// mutates its input; deterministic.
// @param {unknown} report  a parsed JSON object (NOT a string)
// @returns {{valid: boolean, errors: string[], warnings: string[], summary: object}}
// ---------------------------------------------------------------------------

function validateReport(report) {
  const errors = [];
  const warnings = [];

  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    return {
      valid: false,
      errors: ["report is not a JSON object"],
      warnings,
      summary: emptySummary(),
    };
  }

  for (const f of REQUIRED_REPORT_FIELDS) {
    if (!(f in report)) errors.push(`report: missing required field "${f}"`);
  }
  if ("schemaVersion" in report && report.schemaVersion !== SCHEMA_VERSION) {
    errors.push(
      `report.schemaVersion must be "${SCHEMA_VERSION}" (got ${JSON.stringify(report.schemaVersion)})`,
    );
  }
  if ("findings" in report && !Array.isArray(report.findings)) {
    errors.push("report.findings must be an array");
  }

  const findings = Array.isArray(report.findings) ? report.findings : [];
  const seenIds = new Set();
  const bySeverity = {};
  let confirmed = 0;
  let plausible = 0;

  findings.forEach((finding, i) => {
    const idPart = finding && typeof finding === "object" && finding.id ? ` (${finding.id})` : "";
    const where = `findings[${i}]${idPart}`;

    if (finding === null || typeof finding !== "object" || Array.isArray(finding)) {
      errors.push(`${where}: finding is not an object`);
      return;
    }

    for (const f of REQUIRED_FINDING_FIELDS) {
      if (!(f in finding)) errors.push(`${where}: missing required field "${f}"`);
    }
    if ("severity" in finding && !SEVERITY_LEVELS.includes(finding.severity)) {
      errors.push(`${where}: severity "${finding.severity}" not in [${SEVERITY_LEVELS.join("|")}]`);
    }
    if ("confidence" in finding && !CONFIDENCE_LEVELS.includes(finding.confidence)) {
      errors.push(
        `${where}: confidence "${finding.confidence}" not in [${CONFIDENCE_LEVELS.join("|")}]`,
      );
    }
    if ("dataFlowRole" in finding && !DATA_FLOW_ROLES.includes(finding.dataFlowRole)) {
      errors.push(
        `${where}: dataFlowRole "${finding.dataFlowRole}" not in [${DATA_FLOW_ROLES.join("|")}]`,
      );
    }
    if ("preconditions" in finding && !Array.isArray(finding.preconditions)) {
      errors.push(`${where}: preconditions must be an array (empty = unconditional)`);
    }
    if ("evidence" in finding) {
      if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) {
        errors.push(
          `${where}: evidence must be a NON-EMPTY array — every finding names its evidence`,
        );
      }
    }
    if ("id" in finding && typeof finding.id === "string") {
      if (seenIds.has(finding.id)) warnings.push(`${where}: duplicate finding id "${finding.id}"`);
      seenIds.add(finding.id);
    }

    // Tally only well-typed values so a malformed report still yields a summary.
    if (SEVERITY_LEVELS.includes(finding.severity)) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    }
    if (finding.confidence === "confirmed") confirmed += 1;
    else if (finding.confidence === "plausible") plausible += 1;
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: { findings: findings.length, confirmed, plausible, bySeverity },
  };
}

// ---------------------------------------------------------------------------
// rankFindings — order for "report first, ranked by severity, with evidence".
// Severity first (critical→info), then confidence (confirmed before plausible),
// stable within a tier. Pure; tolerant of malformed entries.
// ---------------------------------------------------------------------------

function rankFindings(findings) {
  const list = Array.isArray(findings) ? findings : [];
  return [...list]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const sa = SEVERITY_RANK[a.f && a.f.severity] ?? 99;
      const sb = SEVERITY_RANK[b.f && b.f.severity] ?? 99;
      if (sa !== sb) return sa - sb;
      const ca = a.f && a.f.confidence === "confirmed" ? 0 : 1;
      const cb = b.f && b.f.confidence === "confirmed" ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return a.i - b.i;
    })
    .map((x) => x.f);
}

// ---------------------------------------------------------------------------
// buildValidation — PURE validation manifest (no timestamp inside so the object
// is byte-stable). The CLI injects `generated` only at file-write time. Accepts
// the already-parsed report object.
// ---------------------------------------------------------------------------

const NOTICE =
  "ADVISORY finding-contract check. It validates the SHAPE of an audit report against report-schema.json (never the truth of a finding, never a cap on what an audit may report). Default exit 0; --strict opts into a non-zero exit on a contract violation.";

function buildValidation(report, opts = {}) {
  const source = opts.source || "findings.json";
  if (opts.degraded) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generator: "validate-findings.mjs",
      frameworkVersion: FRAMEWORK_VERSION,
      contract: "report-schema.json",
      source,
      posture: "ADVISORY",
      notice: `${opts.degradedReason || "No findings report to validate."} ${NOTICE}`,
      degraded: true,
      valid: true,
      errorCount: 0,
      warningCount: 0,
      summary: emptySummary(),
      errors: [],
      warnings: [],
      ranked: [],
    };
  }

  const res = validateReport(report);
  const ranked = rankFindings(report && typeof report === "object" ? report.findings : []).map(
    (f) => ({
      id: f && f.id,
      severity: f && f.severity,
      confidence: f && f.confidence,
      title: f && f.title,
    }),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    generator: "validate-findings.mjs",
    frameworkVersion: FRAMEWORK_VERSION,
    contract: "report-schema.json",
    source,
    posture: "ADVISORY",
    notice: NOTICE,
    degraded: false,
    valid: res.valid,
    errorCount: res.errors.length,
    warningCount: res.warnings.length,
    summary: res.summary,
    errors: res.errors,
    warnings: res.warnings,
    ranked,
  };
}

// ---------------------------------------------------------------------------
// renderReport — human-readable markdown, led by the advisory banner.
// ---------------------------------------------------------------------------

function renderReport(v) {
  const lines = [];
  lines.push("# Audit Findings Validation (ADVISORY — shape, not truth)");
  lines.push("");
  lines.push(`> ${v.notice}`);
  lines.push(">");
  lines.push(`> Contract: \`${v.contract}\` (deliverable #45) · Generator: \`${v.generator}\``);
  lines.push("");
  const verdict = v.degraded ? "DEGRADED (nothing to validate)" : v.valid ? "VALID ✅" : "INVALID ❌";
  lines.push(
    `Source: \`${v.source}\` · Verdict: **${verdict}** · Errors: ${v.errorCount} · Warnings: ${v.warningCount} · Findings: ${v.summary.findings} · Confirmed: ${v.summary.confirmed} · Plausible: ${v.summary.plausible}`,
  );
  lines.push("");

  lines.push("## Contract violations (errors)");
  lines.push("");
  if (v.errors.length === 0) {
    lines.push("_None._");
  } else {
    for (const e of v.errors) lines.push(`- ${e}`);
  }
  lines.push("");

  if (v.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of v.warnings) lines.push(`- ${w}`);
    lines.push("");
  }

  lines.push("## Findings ranked (severity → confidence)");
  lines.push("");
  if (v.ranked.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| # | Severity | Confidence | Id | Title |");
    lines.push("|---|---|---|---|---|");
    v.ranked.forEach((f, i) => {
      lines.push(
        `| ${i + 1} | ${f.severity ?? "—"} | ${f.confidence ?? "—"} | ${f.id ?? "—"} | ${f.title ?? "—"} |`,
      );
    });
  }
  lines.push("");

  return lines.join("\n");
}

export {
  SCHEMA_VERSION,
  SEVERITY_LEVELS,
  CONFIDENCE_LEVELS,
  DATA_FLOW_ROLES,
  REQUIRED_REPORT_FIELDS,
  REQUIRED_FINDING_FIELDS,
  SEVERITY_RANK,
  validateReport,
  rankFindings,
  buildValidation,
  renderReport,
};

// ---------------------------------------------------------------------------
// SELF-TEST (POW-24 pattern). Feeds embedded fixtures through the SAME real
// functions the CLI uses — validateReport / rankFindings / buildValidation — with
// no filesystem, and asserts each result. Prints one line per assertion, then
// `PASS — N/N assertions passed`; exits 0 on all-pass, 1 on ANY regression, so
// `node validate-findings.mjs --self-test` is a genuine failable gate, mirroring
// audit-scope.mjs / review-scope.mjs.
// ---------------------------------------------------------------------------

const _isTTY = process.stdout.isTTY;
const _RST = _isTTY ? "\x1b[0m" : "";
const _RED = _isTTY ? "\x1b[31m" : "";
const _GRN = _isTTY ? "\x1b[32m" : "";
const _CYN = _isTTY ? "\x1b[36m" : "";
const _PASS = `${_GRN}PASS${_RST}`;
const _FAIL = `${_RED}FAIL${_RST}`;

function _validFinding(over = {}) {
  return {
    id: "F-1",
    title: "Unauthenticated route handler",
    severity: "high",
    confidence: "confirmed",
    dataFlowRole: "sink",
    preconditions: ["route is reachable without a session"],
    evidence: ["src/app/api/x/route.ts:12"],
    ...over,
  };
}

function _validReport(findings) {
  return {
    schemaVersion: "1.0",
    generator: "self-test",
    target: "example-app",
    findings,
  };
}

function selfTest() {
  let failures = 0;
  const results = [];
  const record = (label, ok) => {
    results.push({ label, ok });
    if (!ok) failures += 1;
  };

  // Fixture 1: a fully valid report passes + tallies confirmed/plausible + severity.
  const r1 = validateReport(
    _validReport([_validFinding(), _validFinding({ id: "F-2", confidence: "plausible", severity: "low" })]),
  );
  record(
    "valid report → valid=true, summary tallies (2 findings, 1 confirmed, 1 plausible)",
    r1.valid === true &&
      r1.errors.length === 0 &&
      r1.summary.findings === 2 &&
      r1.summary.confirmed === 1 &&
      r1.summary.plausible === 1 &&
      r1.summary.bySeverity.high === 1 &&
      r1.summary.bySeverity.low === 1,
  );

  // Fixture 2: a missing top-level required field is a contract violation.
  const noFindings = { schemaVersion: "1.0", generator: "x", target: "y" };
  const r2 = validateReport(noFindings);
  record(
    "missing report.findings → invalid with a targeted error",
    r2.valid === false && r2.errors.some((e) => /missing required field "findings"/.test(e)),
  );

  // Fixture 3: a bad severity enum value is caught.
  const r3 = validateReport(_validReport([_validFinding({ severity: "urgent" })]));
  record(
    "bad severity enum → invalid, names the offending value",
    r3.valid === false && r3.errors.some((e) => /severity "urgent"/.test(e)),
  );

  // Fixture 4: empty evidence array violates the mandatory-evidence law.
  const r4 = validateReport(_validReport([_validFinding({ evidence: [] })]));
  record(
    "empty evidence array → invalid (every finding names its evidence)",
    r4.valid === false && r4.errors.some((e) => /evidence must be a NON-EMPTY array/.test(e)),
  );

  // Fixture 5: a missing taxonomy field (dataFlowRole) is required.
  const f5 = _validFinding();
  delete f5.dataFlowRole;
  const r5 = validateReport(_validReport([f5]));
  record(
    "missing dataFlowRole taxonomy axis → invalid",
    r5.valid === false && r5.errors.some((e) => /missing required field "dataFlowRole"/.test(e)),
  );

  // Fixture 6: rankFindings orders critical-confirmed before low-plausible.
  const ranked = rankFindings([
    _validFinding({ id: "lo", severity: "low", confidence: "plausible" }),
    _validFinding({ id: "hi", severity: "critical", confidence: "confirmed" }),
    _validFinding({ id: "hi-plaus", severity: "critical", confidence: "plausible" }),
  ]);
  record(
    "rankFindings: critical>low, confirmed>plausible within a tier",
    ranked[0].id === "hi" && ranked[1].id === "hi-plaus" && ranked[2].id === "lo",
  );

  // Fixture 7: a non-object report degrades gracefully (no crash), reports invalid.
  const r7 = validateReport(null);
  const r7b = validateReport("not an object");
  record(
    "non-object report → invalid, no crash, empty summary",
    r7.valid === false && r7b.valid === false && r7.summary.findings === 0,
  );

  // Fixture 8: buildValidation is deterministic (no timestamp inside).
  const rep = _validReport([_validFinding()]);
  const a = JSON.stringify(buildValidation(rep, { source: "x.json" }));
  const b = JSON.stringify(buildValidation(rep, { source: "x.json" }));
  record("buildValidation is deterministic (byte-stable, no timestamp inside)", a === b);

  console.log(`\n${_CYN}=== validate-findings.mjs self-test ===${_RST}`);
  for (const { label, ok } of results) {
    console.log(`  [${ok ? _PASS : _FAIL}] ${label}`);
  }
  const overall = failures === 0;
  console.log(
    `\n${overall ? _PASS : _FAIL} — ${results.length - failures}/${results.length} assertions passed\n`,
  );
  process.exit(overall ? 0 : 1);
}

const HELP = `validate-findings.mjs — audit-finding contract validator (deliverable #45)

Validates an audit-findings report (findings.json) against report-schema.json:
the taxonomy axes severity · confidence · dataFlowRole · preconditions + mandatory
non-empty evidence. ADVISORY — checks SHAPE, not truth; never blocks by default.

Usage:
  node scripts/validate-findings.mjs                       Validate test-artifacts/audit/findings.json, exit 0
  node scripts/validate-findings.mjs <file>                Validate <file> instead
  node scripts/validate-findings.mjs --file <file>         Same, explicit flag
  node scripts/validate-findings.mjs --strict              Exit 1 on a contract violation (opt-in gate)
  node scripts/validate-findings.mjs --report-only         Explicit default (always exit 0)
  node scripts/validate-findings.mjs --self-test           Run embedded-fixture regression, print PASS N/N
  node scripts/validate-findings.mjs --help                This message

Exit codes:
  0  validated (always, unless --strict found a violation) / self-test PASS / no findings file
  1  --strict found a contract violation, OR self-test found a regression`;

// ---------------------------------------------------------------------------
// CLI entry. Default path ALWAYS exits 0 (advisory) — a missing findings file or
// a contract violation is reported, never fatal. `--strict` opts into exit 1 on
// a violation. Writes the validation manifest (JSON + markdown) to
// test-artifacts/audit/ and prints the markdown.
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }
  if (cliArgs.includes("--self-test")) {
    selfTest(); // calls process.exit() itself
  }

  const { readFileSync, existsSync, mkdirSync, writeFileSync } = await import("node:fs");

  const args = process.argv.slice(2);
  const argVal = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };
  const strict = args.includes("--strict");
  const positional = args.find((a) => !a.startsWith("-"));
  const source = argVal("--file") || positional || "test-artifacts/audit/findings.json";

  let validation;
  if (!existsSync(source)) {
    validation = buildValidation(null, {
      source,
      degraded: true,
      degradedReason: `No findings report found at "${source}".`,
    });
  } else {
    let report = null;
    let parseError = null;
    try {
      report = JSON.parse(readFileSync(source, "utf8"));
    } catch (err) {
      parseError = err.message;
    }
    if (parseError !== null) {
      validation = buildValidation(null, { source });
      validation.valid = false;
      validation.errorCount = 1;
      validation.errors = [`could not parse "${source}" as JSON: ${parseError}`];
    } else {
      validation = buildValidation(report, { source });
    }
  }

  const generated = new Date().toISOString();
  const out = { generated, ...validation };

  try {
    mkdirSync("test-artifacts/audit", { recursive: true });
    writeFileSync(
      "test-artifacts/audit/findings-validation.json",
      JSON.stringify(out, null, 2) + "\n",
      "utf8",
    );
    writeFileSync("test-artifacts/audit/findings-validation.md", renderReport(validation), "utf8");
  } catch (err) {
    console.error("validate-findings: could not write validation manifest:", err.message);
  }

  console.log(renderReport(validation));
  process.exit(strict && !validation.valid ? 1 : 0);
}
