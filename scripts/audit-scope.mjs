// audit-scope.mjs — deterministic full-audit pre-scope tool (V32.52, deliverable #42).
// Sibling of review-scope.mjs (#40). Zero runtime deps (node:* stdlib only).
//
// Extends the review-scope pre-scope PATTERN from code-review to the
// `full audit check` semantic swarm: it parses what changed, classifies the
// TARGET TYPE (framework / app / foreign / session), and resolves per changed
// surface (a) which audit DIMENSIONS apply and (b) which existing mechanical
// GATE script is relevant — emitting a FLOOR manifest the full-audit Architect
// consumes as its starting dimension taxonomy, before it enumerates its own.
//
// DESIGN LAW 1 (FLOOR-not-ceiling). The manifest is the MINIMUM the swarm must
//   cover, NEVER a cap on it. Absence of a dimension here is NOT permission to
//   skip it — the swarm's completeness critic is precisely what re-adds what
//   this mechanical pass could not see. Never blocks an audit, a commit, or a
//   build; always exit(0).
// DESIGN LAW 2 (deterministic, no LLM in the pre-step). Pure functions over a
//   git diff + a target-type classifier + hardcoded DIMENSION_RULES / GATE_RULES
//   tables (mirroring review-scope's LENS_RULES / SCANNER_RULES). Same input →
//   same manifest, byte-for-byte. The JUDGMENT stays entirely in the 🧠 swarm;
//   this pre-step only scopes it.
//
// Authority: ~/.claude/library/full-audit-check-trigger.md (dimension taxonomy)
//   + invisible-quality-radar.md (D1-D10, primer-FLAG scoped). GATE_RULES point
//   at the already-built AIEF mechanical scripts (Option A — list-only; this
//   tool names the relevant gates, the Architect runs them).

// ---------------------------------------------------------------------------
// Diff parsing — identical contract to review-scope.mjs parseDiff (renames
// land under their new b/ path; +++ header never counted as content).
// ---------------------------------------------------------------------------

/**
 * Parse a unified diff (as produced by `git diff`) into per-file records.
 * @param {string} text
 * @returns {{path: string, status: string, added: string[], removedCount: number}[]}
 */
function parseDiff(text) {
  const lines = text.split("\n");
  const files = [];
  let current = null;

  const fileHeaderRe = /^diff --git a\/(.+?) b\/(.+)$/;

  for (const line of lines) {
    const headerMatch = line.match(fileHeaderRe);
    if (headerMatch) {
      current = { path: headerMatch[2], status: "modified", added: [], removedCount: 0 };
      files.push(current);
      continue;
    }
    if (!current) continue;

    if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
      continue;
    }
    if (line.startsWith("rename from") || line.startsWith("rename to")) {
      current.status = "renamed";
      continue;
    }
    if (line.startsWith("new file mode")) {
      current.status = "added";
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      // diff header lines — never content, always skip
      continue;
    }
    if (line.startsWith("+")) {
      current.added.push(line.slice(1));
      continue;
    }
    if (line.startsWith("-")) {
      current.removedCount += 1;
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Target-type classification (the key adaptation over review-scope). Pure over
// an explicit signals object so it is deterministic + testable; the CLI gathers
// the signals from the filesystem. An explicit --target-type override wins.
// ---------------------------------------------------------------------------

const TARGET_TYPES = ["framework", "app", "foreign", "session"];

/**
 * Classify the audit target from deterministic repo signals.
 * @param {{override?: string, hasSpecPrompt?: boolean, hasMasterPrompt?: boolean,
 *          hasProduct?: boolean, hasInputs?: boolean, hasPrismaSchema?: boolean,
 *          isGitRepo?: boolean}} signals
 * @returns {"framework"|"app"|"foreign"|"session"}
 */
function classifyTarget(signals = {}) {
  if (signals.override && TARGET_TYPES.includes(signals.override)) {
    return signals.override;
  }
  if (signals.hasSpecPrompt && signals.hasMasterPrompt) return "framework";
  if (signals.hasProduct && (signals.hasInputs || signals.hasPrismaSchema)) return "app";
  if (signals.isGitRepo) return "foreign";
  return "foreign";
}

// ---------------------------------------------------------------------------
// Audit-worthiness gate — same conservative default-INCLUDE posture as
// review-scope's reviewWorthy. Excludes certain-noise ONLY; always keeps
// .d.ts, deletions, tests, config, docs, migrations.
// ---------------------------------------------------------------------------

const SKIP_PATTERNS = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/,
  /(^|\/)(dist|\.next|node_modules)\//,
  /\.(png|jpe?g|gif|svg|ico|webp|woff2?|map)$/i,
  /\.snap$/,
];

const GENERATED_HEADER_RE = /@generated|DO NOT EDIT|prisma-client|Code generated by/;

/**
 * Conservative audit-worthiness gate. Default = INCLUDE; excludes only
 * certain-noise. Never excludes .d.ts, deletions, tests, config, docs.
 * @param {string} path
 * @param {string[]} addedLines
 * @returns {{worthy: boolean, reason: string}}
 */
function auditWorthy(path, addedLines) {
  for (const re of SKIP_PATTERNS) {
    if (re.test(path)) {
      return { worthy: false, reason: `matches skip pattern: ${re}` };
    }
  }

  const headSlice = (addedLines || []).slice(0, 5);
  if (headSlice.some((line) => GENERATED_HEADER_RE.test(line))) {
    return { worthy: false, reason: "generated-file header marker detected" };
  }

  return { worthy: true, reason: "no exclusion matched — default include" };
}

// ---------------------------------------------------------------------------
// DIMENSION_RULES — surface → audit dimension (the 🧠 floor). Mirrors the
// `full-audit-check-trigger.md` taxonomy + invisible-quality-radar D1-D10.
// Each rule: { id, why, path?, content?, targetTypes[], flag?, deletionAware?,
//             requiresAbsent? }. Fires on pathHit || contentHit; confidence =
// "content" when the strong content signal fired, else "path" (a FLAG-forced
// D-dimension is tagged "hard"). targetTypes gates the rule to the target types
// where it is meaningful (e.g. regression auto-SKIPs on framework/session).
// ---------------------------------------------------------------------------

const DIMENSION_RULES = [
  {
    id: "cross-ref-drift",
    why: "count/version parity across count-bearing framework files",
    path: /(Master_Prompt\.md|CLAUDE_compact\.md|CLAUDE_framework_repo\.md|Framework_Feature_Index\.md|deploy\.sh|(^|\/)CLAUDE\.md|(^|\/)README\.md|documentation-hub\.html|Prompt_References\.html)$/,
    targetTypes: ["framework"],
  },
  {
    id: "claim-vs-reality",
    why: "spec ↔ schema ↔ impl drift candidate",
    path: /(docs\/PRODUCT\.md|(^|\/)inputs\.yml|schema\.prisma|IMPLEMENTATION_MAP\.md)$/,
    targetTypes: ["framework", "app", "foreign", "session"],
  },
  {
    id: "regression",
    why: "shared-contract change or large deletion (blast-radius)",
    content: /(export (async )?function |export (const|type|interface|class) |interface \w+|type \w+ ?=|model \w+ \{|z\.object\(|NextResponse|ApiResponse)/,
    targetTypes: ["app", "foreign"],
    deletionAware: true,
  },
  {
    id: "D1-security",
    why: "auth / route-handler / RBAC / token / upload surface",
    path: /(auth|middleware\.(t|j)s|routers?\/|\/api\/|route\.(t|j)sx?$|guard|upload|token)/,
    content: /(publicProcedure|protectedProcedure|hasPermission|req\.(json|formData)\(\)|Bearer|multipart|bcrypt|jwt)/,
    targetTypes: ["framework", "app", "foreign"],
  },
  {
    id: "D2-seo",
    why: "public route / page metadata / sitemap / robots",
    path: /(sitemap\.(t|j)sx?$|robots\.(t|j)sx?$|\(public\)\/|opengraph)/,
    content: /(export const metadata|generateMetadata|openGraph|twitter:)/,
    targetTypes: ["app", "foreign"],
  },
  {
    id: "D3-a11y",
    why: "UI / form / motion surface (HARD gate when gov-LGU)",
    path: /(components?\/|\.tsx$|(^|\/)forms?\/|motion|animation)/,
    targetTypes: ["app", "foreign"],
    flag: { key: "GOV_LGU", value: "yes", hard: true },
  },
  {
    id: "D4-privacy",
    why: "personal / sensitive-data surface",
    path: /(user|profile|patient|citizen|resident|pii|personal|medical|payroll)/i,
    targetTypes: ["app", "foreign"],
    flag: { key: "DATA_SENSITIVITY", value: "personal" },
  },
  {
    id: "D5-audit-ability",
    why: "security-relevant mutation — verify an adjacent AuditLog write",
    content: /\.(create|update|delete|deleteMany|updateMany)\(/,
    targetTypes: ["app", "foreign"],
    requiresAbsent: /AuditLog|auditLog|logAudit|writeAudit/,
  },
  {
    id: "stray-artifacts",
    why: "untracked scratch / pointer file left in the repo",
    path: /(SUGGESTED_|SCRATCH|(^|\/)TMP_|_SCRATCH|\.bak$|\.orig$|\.tmp$)/,
    targetTypes: ["framework", "app", "foreign", "session"],
  },
  {
    id: "coverage",
    why: "TODO / FIXME or an unimplemented spec section",
    content: /(TODO|FIXME|XXX|@stub|not implemented|unimplemented)/i,
    targetTypes: ["framework", "app", "foreign", "session"],
  },
];

const DIMENSION_IDS = DIMENSION_RULES.map((r) => r.id);

/**
 * Resolve the guaranteed-minimum audit dimensions for an audit-worthy file.
 * Gated by targetType (rule.targetTypes) and, for D-dimensions, by the app's
 * primer FLAGS (rule.flag). Fires on pathHit || contentHit, plus:
 *   - deletionAware rules also fire on a deletion or a large-removal hunk;
 *   - requiresAbsent rules fire only when content matched AND the guard token
 *     is NOT present (e.g. a mutation with no adjacent AuditLog).
 * @param {{path: string, added: string[], status?: string, removedCount?: number}} file
 * @param {{targetType: string, flags?: Record<string,string>}} ctx
 * @returns {{id: string, why: string, confidence: string}[]}
 */
function resolveDimensions(file, ctx = {}) {
  const targetType = ctx.targetType || "foreign";
  const flags = ctx.flags || {};
  const content = (file.added || []).join("\n");
  const isBigDeletion = file.status === "deleted" || (file.removedCount || 0) >= 30;
  const results = [];

  for (const rule of DIMENSION_RULES) {
    if (!rule.targetTypes.includes(targetType)) continue;

    // FLAG gate — a D-dimension only floors when the primer FLAG matches.
    let hardFlag = false;
    if (rule.flag) {
      const have = (flags[rule.flag.key] || "").toString().toLowerCase();
      if (have !== rule.flag.value.toLowerCase()) continue;
      hardFlag = !!rule.flag.hard;
    }

    const pathHit = rule.path ? rule.path.test(file.path) : false;
    const contentHit = rule.content ? rule.content.test(content) : false;
    const deletionHit = rule.deletionAware ? isBigDeletion : false;

    // requiresAbsent: only a floor when the pattern matched AND the guard is missing.
    if (rule.requiresAbsent) {
      if (!contentHit) continue;
      if (rule.requiresAbsent.test(content)) continue;
    }

    if (!(pathHit || contentHit || deletionHit)) continue;

    let confidence;
    if (hardFlag) confidence = "hard";
    else if (contentHit) confidence = "content";
    else if (deletionHit) confidence = "content";
    else confidence = "path";

    results.push({ id: rule.id, why: rule.why, confidence });
  }

  return results;
}

// ---------------------------------------------------------------------------
// GATE_RULES — surface → existing 🔧 mechanical script (the reuse insight).
// Option A (list-only): this tool resolves WHICH already-built gate scripts are
// relevant to the changed surfaces and names them for the Architect to run — it
// does NOT run them (keeps Law 2's determinism + speed). Every `script` here is
// an existing AIEF deliverable/gate (guarded by the parity test).
// ---------------------------------------------------------------------------

const GATE_RULES = [
  {
    script: "check-framework-alignment.sh",
    path: /(specdrivenprompt\/|Master_Prompt\.md|CLAUDE_compact\.md|CLAUDE_framework_repo\.md|Framework_Feature_Index\.md|(^|\/)CLAUDE\.md$|(^|\/)README\.md$|deploy\.sh|documentation-hub\.html|Prompt_References\.html)/,
    targetTypes: ["framework"],
  },
  {
    script: "spec-gap-check.sh",
    path: /(docs\/PRODUCT\.md|(^|\/)inputs\.yml|schema\.prisma|IMPLEMENTATION_MAP\.md)$/,
    targetTypes: ["framework", "app"],
  },
  {
    script: "lint-deploy.sh",
    path: /(^|\/)deploy\/compose\//,
    targetTypes: ["app", "foreign"],
  },
  {
    script: "lint-design.sh",
    path: /(components?\/|\.tsx$|globals\.css$)/,
    targetTypes: ["app", "foreign"],
  },
  {
    script: "dev-freshness-check.sh",
    path: /(^|\/)deploy\/compose\/|docker-compose\.ya?ml$/,
    targetTypes: ["app"],
  },
  {
    script: "review-scope.mjs",
    path: /\.(ts|tsx|js|jsx|mjs)$/,
    targetTypes: ["framework", "app", "foreign"],
  },
  {
    script: "sync-context.sh",
    path: /(^|\/)CLAUDE\.md$/,
    targetTypes: ["app"],
  },
  {
    script: "audit-app.sh",
    path: /\.(ts|tsx|js|jsx|env|ya?ml|json)$|Dockerfile/,
    targetTypes: ["app", "foreign"],
  },
];

const GATE_SCRIPTS = GATE_RULES.map((r) => r.script);

/**
 * Resolve the relevant mechanical gate scripts for an audit-worthy file (Option
 * A — names only, never runs them). Same fire logic as resolveDimensions'
 * path/content, gated by targetType.
 * @param {{path: string, added: string[]}} file
 * @param {{targetType: string}} ctx
 * @returns {{script: string, confidence: string}[]}
 */
function resolveGates(file, ctx = {}) {
  const targetType = ctx.targetType || "foreign";
  const content = (file.added || []).join("\n");
  const results = [];

  for (const rule of GATE_RULES) {
    if (rule.targetTypes && !rule.targetTypes.includes(targetType)) continue;
    const pathHit = rule.path ? rule.path.test(file.path) : false;
    const contentHit = rule.content ? rule.content.test(content) : false;
    if (pathHit || contentHit) {
      results.push({ script: rule.script, confidence: contentHit ? "content" : "path" });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Primer-FLAG parsing — reads the marker-delimited AIEF:PRIMER region of a
// target app's CLAUDE.md into a flat { KEY: value } map, so D3/D4 floor only
// where the app's declared capability warrants (invisible-quality-radar scope).
// Unknown / absent → empty map (the D-dimensions simply don't floor).
// ---------------------------------------------------------------------------

/**
 * Parse `KEY: value` lines inside the <!-- AIEF:PRIMER START -->…END --> region.
 * @param {string} text  full CLAUDE.md content
 * @returns {Record<string,string>}
 */
function parsePrimerFlags(text) {
  const flags = {};
  if (!text) return flags;
  const m = text.match(/AIEF:PRIMER START[\s\S]*?AIEF:PRIMER END/);
  if (!m) return flags;
  const region = m[0];
  const lineRe = /^[\s>*-]*([A-Z][A-Z0-9_]+)\s*[:=]\s*(.+?)\s*$/gm;
  let hit;
  while ((hit = lineRe.exec(region)) !== null) {
    flags[hit[1]] = hit[2].replace(/`/g, "").trim();
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Manifest emission. FLOOR-not-ceiling posture. buildManifest is a PURE
// function (no timestamp inside) so the returned object is deterministic; the
// CLI injects a `generated` ISO timestamp only at file-write time.
// ---------------------------------------------------------------------------

const FLOOR_NOTICE =
  "MINIMUM guaranteed audit dimensions. This ADDS to the Architect's open-ended audit; it never caps or replaces it. Absence of a dimension here is NOT permission to skip it — the completeness critic re-adds what this mechanical pass could not see.";

const FRAMEWORK_VERSION = "V32.52";

/**
 * Build the deterministic pre-scope manifest from raw diff text.
 * @param {string} diffText
 * @param {{targetType?: string, flags?: Record<string,string>, diffBase?: string, degraded?: boolean}} [opts]
 * @returns {object}
 */
function buildManifest(diffText, opts = {}) {
  const targetType = opts.targetType || "foreign";
  const flags = opts.flags || {};
  const diffBase = opts.diffBase || "working-tree";
  const parsed = parseDiff(diffText);

  const surfaces = [];
  const skipped = [];
  let dimensionAssignments = 0;
  const relevantGates = new Set();

  for (const file of parsed) {
    const gate = auditWorthy(file.path, file.added);
    if (!gate.worthy) {
      skipped.push({ file: file.path, reason: gate.reason });
      continue;
    }

    const ctx = { targetType, flags };
    const dimensions =
      file.status === "deleted"
        ? resolveDimensions(file, ctx) // deletion is dimension-aware (regression + stray)
        : resolveDimensions(file, ctx);
    const gates = resolveGates(file, ctx);
    dimensionAssignments += dimensions.length;
    for (const g of gates) relevantGates.add(g.script);

    surfaces.push({
      file: file.path,
      auditWorthy: true,
      reason:
        file.status === "deleted"
          ? "deletion — verify no dropped authz/ref/contract"
          : gate.reason,
      dimensions,
      gates,
    });
  }

  return {
    schemaVersion: "1.0",
    generator: "audit-scope.mjs",
    frameworkVersion: FRAMEWORK_VERSION,
    targetType,
    diffBase,
    posture: "FLOOR-NOT-CEILING",
    notice: opts.degraded
      ? `Diff could not be read — degraded empty manifest. ${FLOOR_NOTICE}`
      : FLOOR_NOTICE,
    degraded: !!opts.degraded,
    dimensionAuthority:
      "~/.claude/library/full-audit-check-trigger.md + invisible-quality-radar.md (D1-D10, primer-FLAG scoped)",
    gateAuthority:
      "AIEF scripts/ (check-framework-alignment · spec-gap-check · lint-deploy · lint-design · dev-freshness-check · review-scope · sync-context · audit-app)",
    summary: {
      surfacesChanged: parsed.length,
      auditWorthy: surfaces.length,
      skipped: skipped.length,
      dimensionAssignments,
      gatesRelevant: relevantGates.size,
    },
    relevantGates: [...relevantGates],
    surfaces,
    skipped,
  };
}

/**
 * Render the manifest as a human-readable markdown table, led by the
 * FLOOR-not-ceiling banner.
 * @param {object} manifest
 * @returns {string}
 */
function renderTable(manifest) {
  const lines = [];
  lines.push("# Full-Audit Pre-Scope Manifest (FLOOR, NOT CEILING)");
  lines.push("");
  lines.push(`> ${manifest.notice}`);
  lines.push(">");
  lines.push(
    `> Dimension authority: \`${manifest.dimensionAuthority}\` · Gate authority: \`${manifest.gateAuthority}\``,
  );
  lines.push("");
  lines.push(
    `Target type: \`${manifest.targetType}\` · Diff base: \`${manifest.diffBase}\` · Surfaces changed: ${manifest.summary.surfacesChanged} · Audit-worthy: ${manifest.summary.auditWorthy} · Skipped: ${manifest.summary.skipped} · Dimension floors: ${manifest.summary.dimensionAssignments} · Gates relevant: ${manifest.summary.gatesRelevant}`,
  );
  lines.push("");

  lines.push("## Audit-worthy surfaces (minimum guaranteed dimensions)");
  lines.push("");
  if (manifest.surfaces.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Surface | Dimensions (id: confidence) | Gates | Reason |");
    lines.push("|---|---|---|---|");
    for (const s of manifest.surfaces) {
      const dimStr =
        s.dimensions.length === 0
          ? "—"
          : s.dimensions.map((d) => `${d.id}:${d.confidence}`).join(", ");
      const gateStr = s.gates.length === 0 ? "—" : s.gates.map((g) => g.script).join(", ");
      lines.push(`| ${s.file} | ${dimStr} | ${gateStr} | ${s.reason} |`);
    }
  }
  lines.push("");

  lines.push("## Relevant mechanical gates (run these — Option A list-only)");
  lines.push("");
  if (manifest.relevantGates.length === 0) {
    lines.push("_None._");
  } else {
    for (const g of manifest.relevantGates) lines.push(`- \`${g}\``);
  }
  lines.push("");

  lines.push("## Skipped (certain-noise only)");
  lines.push("");
  if (manifest.skipped.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Surface | Reason |");
    lines.push("|---|---|");
    for (const s of manifest.skipped) lines.push(`| ${s.file} | ${s.reason} |`);
  }
  lines.push("");

  return lines.join("\n");
}

export {
  parseDiff,
  classifyTarget,
  auditWorthy,
  parsePrimerFlags,
  DIMENSION_RULES,
  DIMENSION_IDS,
  GATE_RULES,
  GATE_SCRIPTS,
  TARGET_TYPES,
  resolveDimensions,
  resolveGates,
  buildManifest,
  renderTable,
};

// ---------------------------------------------------------------------------
// CLI entry. Always exits 0 — this tool never blocks an audit; on any failure
// to read a diff it falls back to a degraded empty-diff manifest that explains
// what happened, still writes it, and exits 0.
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync, existsSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { execSync } = await import("node:child_process");

  const args = process.argv.slice(2);
  const argVal = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };

  // Gather deterministic classification signals from the filesystem.
  let targetType;
  let flags = {};
  try {
    const signals = {
      override: argVal("--target-type"),
      hasSpecPrompt: existsSync("specdrivenprompt"),
      hasMasterPrompt:
        existsSync("specdrivenprompt/Master_Prompt.md") || existsSync("AI/Master_Prompt.md"),
      hasProduct: existsSync("docs/PRODUCT.md"),
      hasInputs: existsSync("inputs.yml"),
      hasPrismaSchema:
        existsSync("prisma/schema.prisma") || existsSync("packages/db/prisma/schema.prisma"),
      isGitRepo: existsSync(".git"),
    };
    targetType = classifyTarget(signals);
    if (existsSync("CLAUDE.md")) {
      flags = parsePrimerFlags(readFileSync("CLAUDE.md", "utf8"));
    }
  } catch {
    targetType = argVal("--target-type") || "foreign";
  }

  let manifest;
  try {
    const diffPath = argVal("--diff");
    const base = argVal("--base");
    let diffText;
    if (diffPath) {
      diffText = readFileSync(diffPath, "utf8");
    } else if (base) {
      diffText = execSync(`git diff ${base}`, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
    } else {
      diffText = execSync("git diff", { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
    }
    const diffBase = diffPath ? diffPath : base || "working-tree";
    manifest = buildManifest(diffText, { targetType, flags, diffBase });
  } catch (err) {
    manifest = buildManifest("", { targetType, flags, degraded: true });
    manifest.notice = `Diff could not be read (${err.message}). ${manifest.notice}`;
  }

  const generated = new Date().toISOString();
  const manifestOut = { generated, ...manifest };

  try {
    mkdirSync("test-artifacts/audit", { recursive: true });
    writeFileSync(
      "test-artifacts/audit/audit-scope-manifest.json",
      JSON.stringify(manifestOut, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      "test-artifacts/audit/audit-scope-manifest.md",
      renderTable(manifest),
      "utf8",
    );
  } catch (err) {
    console.error("audit-scope: could not write manifest:", err.message);
  }

  console.log(renderTable(manifest));
  process.exit(0);
}
