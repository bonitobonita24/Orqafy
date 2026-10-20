#!/usr/bin/env node
// =============================================================================
// design-fidelity.mjs — Powerbyte fleet mockup-anchored layout-fidelity gate
// (V32.36, deliverable #34)
//
// Closes the Design-Drift RCA keystone (Seam D): today the only mockup↔build
// check is a human eyeball. This gate compares the human-approved
// docs/MOCKUP.jsx (rendered via the Phase 3.3 prototype) against the built
// app's own render, CONTENT-AGNOSTICALLY — structural landmark position/size/
// order only, never colors/text/pixels — so real vs placeholder data can never
// trip it. Mirrors lint-deploy.sh (#20) / lint-design.sh (#26) /
// sync-context.sh (#27) / spec-gap-check.sh (#28) house style: same colour/
// state/summary/exit-code shape, same --file path-hardening pattern. Node/
// Playwright (not bash) because the check requires a real DOM render.
//
// Usage:
//   node scripts/design-fidelity.mjs --update-baseline
//     Capture layout signatures FROM the mockup/prototype render (per
//     docs/design-baseline/manifest.json's mockupRoute) and write
//     docs/design-baseline/<screen>.layout.json (committed).
//
//   node scripts/design-fidelity.mjs
//     GATE (default): render the built app's screens (appRoute), diff each
//     against its committed mockup baseline, EXIT NON-ZERO on any violation.
//
//   node scripts/design-fidelity.mjs --report-only
//     Advisory: same diff, findings printed, ALWAYS exit 0.
//
//   node scripts/design-fidelity.mjs --file <relpath>
//     Target a different project-relative manifest.json (default:
//     docs/design-baseline/manifest.json). Path-hardened — clones the
//     lint-deploy.sh / sync-context.sh guard against absolute paths, `..`
//     traversal, and symlink escape.
//
//   node scripts/design-fidelity.mjs --self-test
//     Pure-logic regression (no browser, no Playwright needed) proving the
//     diff/classify function: within-tolerance → PASS, a MOVED anchor beyond
//     posTol → violation, --report-only → exit 0 regardless. Prints
//     PASS/FAIL and exits accordingly. Run this in CI without Playwright
//     installed.
//
//   node scripts/design-fidelity.mjs --tells
//   node scripts/design-fidelity.mjs --tells=all
//     Render-based "design tells" (ADVISORY — ALWAYS, in every mode: tells
//     never change the exit code). Renders each manifest screen's appRoute
//     (same loadPlaywright/resolveUrl/config/viewport plumbing as the layout
//     gate) and inspects computed styles of visible elements for
//     machine-generated-UI tells. `--tells` alone checks only the two
//     default, always-safe tells: pure #000 text color, and box-shadow using
//     opaque black (rgb(0,0,0) or alpha 1). `--tells=all` (or a
//     `tells: ["radius-monotony", ...]` array in design-fidelity.config.json)
//     additionally opts in to 4 token-aware tells that would otherwise false-
//     positive on correct shadcn output: radius-monotony, near-duplicate
//     greys, single shadow stack, flat padding — each skips/narrows when the
//     uniformity traces back to a declared CSS custom property (a single
//     `--radius` var, a declared neutral scale, a shared button-shadow
//     token). No Playwright / no browser / server unreachable → one WARN
//     line, skipped, exit code unchanged. Combinable with --report-only
//     (which still only governs the layout-diff gate's exit code).
//     Tell heuristics adapted from plugin87/ux-ui-agent-skills
//     scripts/slop_tells.mjs (MIT).
//
//   node scripts/design-fidelity.mjs --help
//
// Exit codes:
//   0 — clean / advisory / no baseline yet (nothing to compare) / self-test PASS
//   1 — gate mode found a real violation (or --self-test found a regression)
//   (--tells findings NEVER affect the exit code, in any mode)
//
// Reads (project-relative, best-effort — never fails because a source is
// missing, unless the operation genuinely cannot proceed without it):
//   docs/design-baseline/manifest.json   → { screen: { mockupRoute, appRoute, fixtureState } }
//   design-fidelity.config.json          → { posTol: 0.03, sizeTol: 0.05,
//                                             baseUrl: "http://localhost:3000",
//                                             viewport: {width,height} } (missing = defaults)
//   NOTE: relative manifest routes ("/dashboard") are joined onto config.baseUrl;
//   absolute routes ("http://…") are used verbatim. baseline + gate captures share
//   config.viewport so normalized layout signatures compare fairly.
//   docs/design-baseline/<screen>.layout.json → the committed mockup baseline signature
//
// Layout signature (per [data-fdl] element, per screen — content-agnostic,
// SCOPE §2.2): { fdl, box: {x,y,w,h} normalized 0..1 to viewport, order,
// display }. NO colors, NO text, NO pixels.
//
// Diff classes (SCOPE §2.4):
//   MOVED      — |Δx| or |Δy| > posTol (default 0.03)
//   RESIZED    — |Δw| or |Δh| > sizeTol (default 0.05)
//   MISSING    — anchor present in baseline, absent in build
//   EXTRA      — anchor present in build, absent in baseline
//   REORDERED  — a matched anchor's relative document-order changed
// Dynamic-count regions (lists/tables) are matched at the CONTAINER anchor
// only — a `data-fdl="data-table"` region, never a per-row anchor — so
// varying row counts (real data vs mockup placeholder rows) never trip it.
//
// Graceful degradation:
//   • No manifest.json / no baseline captured yet → print
//     "no baseline — run --update-baseline", exit 0 (nothing to compare).
//   • Playwright not installed → clear message, exit 0 (advisory — we cannot
//     determine drift without a real render, so we never fail closed here).
// =============================================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { realpathSync } from 'node:fs';

// ── Colour helpers (mirrors lint-design.sh / sync-context.sh) ───────────────
const isTTY = process.stdout.isTTY;
const RST = isTTY ? '\x1b[0m' : '';
const RED = isTTY ? '\x1b[31m' : '';
const GRN = isTTY ? '\x1b[32m' : '';
const YLW = isTTY ? '\x1b[33m' : '';
const CYN = isTTY ? '\x1b[36m' : '';
const PASS = `${GRN}PASS${RST}`;
const FAIL = `${RED}FAIL${RST}`;

const DEFAULT_CONFIG = {
  posTol: 0.03,
  sizeTol: 0.05,
  // Base origin for RELATIVE manifest routes (e.g. "/dashboard"). A route that
  // already carries a scheme (http(s)://…) is used verbatim and ignores this.
  baseUrl: 'http://localhost:3000',
  // Deterministic render viewport — layout signatures are normalized to it, so
  // baseline and gate captures MUST share a viewport to compare fairly.
  viewport: { width: 1440, height: 900 },
};
const DEFAULT_MANIFEST_REL = 'docs/design-baseline/manifest.json';

// =============================================================================
// PURE DIFF / CLASSIFY LOGIC — testable without a browser (SCOPE §2.4 + §6)
// =============================================================================

/**
 * Compare a baseline layout signature (captured from the mockup) against a
 * build layout signature (captured from the running app) and classify every
 * deviation. Matching is by `fdl` anchor NAME only — never by text/content —
 * so placeholder-vs-real data can never trip it.
 *
 * @param {Array<{fdl:string, box:{x:number,y:number,w:number,h:number}, order:number, display?:object}>} baseline
 * @param {Array<{fdl:string, box:{x:number,y:number,w:number,h:number}, order:number, display?:object}>} build
 * @param {{posTol:number, sizeTol:number}} [config]
 * @returns {{pass:boolean, violations:Array<{fdl:string, type:string, detail:string}>}}
 */
export function classifyDiff(baseline, build, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const baseMap = new Map((baseline || []).map((s) => [s.fdl, s]));
  const buildMap = new Map((build || []).map((s) => [s.fdl, s]));
  const violations = [];

  for (const fdl of baseMap.keys()) {
    if (!buildMap.has(fdl)) {
      violations.push({ fdl, type: 'MISSING', detail: 'present in mockup baseline, absent in built app' });
    }
  }
  for (const fdl of buildMap.keys()) {
    if (!baseMap.has(fdl)) {
      violations.push({ fdl, type: 'EXTRA', detail: 'present in built app, absent from mockup baseline' });
    }
  }

  const matchedFdls = (baseline || []).filter((s) => buildMap.has(s.fdl)).map((s) => s.fdl);

  for (const fdl of matchedFdls) {
    const b = baseMap.get(fdl);
    const u = buildMap.get(fdl);
    const dx = Math.abs((b.box?.x ?? 0) - (u.box?.x ?? 0));
    const dy = Math.abs((b.box?.y ?? 0) - (u.box?.y ?? 0));
    const dw = Math.abs((b.box?.w ?? 0) - (u.box?.w ?? 0));
    const dh = Math.abs((b.box?.h ?? 0) - (u.box?.h ?? 0));

    if (dx > cfg.posTol || dy > cfg.posTol) {
      violations.push({
        fdl,
        type: 'MOVED',
        detail: `Δx=${dx.toFixed(3)} Δy=${dy.toFixed(3)} (posTol=${cfg.posTol})`,
      });
    }
    if (dw > cfg.sizeTol || dh > cfg.sizeTol) {
      violations.push({
        fdl,
        type: 'RESIZED',
        detail: `Δw=${dw.toFixed(3)} Δh=${dh.toFixed(3)} (sizeTol=${cfg.sizeTol})`,
      });
    }
  }

  // REORDERED — compare the relative document-order of matched anchors only
  // (container-anchor matching means dynamic row counts never affect this).
  const baseOrder = [...(baseline || [])]
    .filter((s) => buildMap.has(s.fdl))
    .sort((a, b) => a.order - b.order)
    .map((s) => s.fdl);
  const buildOrder = [...(build || [])]
    .filter((s) => baseMap.has(s.fdl))
    .sort((a, b) => a.order - b.order)
    .map((s) => s.fdl);

  baseOrder.forEach((fdl, i) => {
    if (buildOrder[i] !== fdl) {
      violations.push({
        fdl,
        type: 'REORDERED',
        detail: `baseline document-position ${i}, build document-position ${buildOrder.indexOf(fdl)}`,
      });
    }
  });

  return { pass: violations.length === 0, violations };
}

/**
 * Resolve the process exit code for a diff result, given the run mode.
 * `--report-only` is ALWAYS advisory (exit 0) regardless of findings — the
 * one hard rule that separates it from the default/gate mode.
 * @param {'gate'|'report-only'} mode
 * @param {boolean} hasViolations
 */
export function resolveExitCode(mode, hasViolations) {
  if (mode === 'report-only') return 0;
  return hasViolations ? 1 : 0;
}

// =============================================================================
// TELL CLASSIFIERS — pure logic, testable without a browser (--tells).
// Tell heuristics adapted from plugin87/ux-ui-agent-skills scripts/slop_tells.mjs
// (MIT). Operate on plain computed-style STRINGS/records extracted by
// extractTellData() — never on the DOM directly — so they're unit-testable
// with synthetic fixtures the same way classifyDiff() is above. Findings are
// ALWAYS advisory: nothing in this section ever influences resolveExitCode().
// =============================================================================

const OPT_IN_TELL_IDS = ['radius-monotony', 'near-duplicate-greys', 'single-shadow-stack', 'flat-padding'];

function parseRgba(str) {
  const m = (str || '').match(
    /rgba?\(\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)(?:[,\s/]+(-?\d+\.?\d*))?/i,
  );
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return { r, g, b, a };
}

/**
 * DEFAULT tell 1 — pure #000 text. A single computed `color` string.
 * False-positive caveat: a tinted near-black (e.g. #0a0a0a) is NOT flagged —
 * only an exact (0,0,0) triple trips it. That is deliberate: shadcn/most
 * design systems use a tinted foreground token, never literal black.
 * @param {string} color computed `color` e.g. "rgb(0, 0, 0)"
 */
export function isPureBlackText(color) {
  const c = parseRgba(color);
  return !!c && c.r === 0 && c.g === 0 && c.b === 0;
}

/**
 * DEFAULT tell 2 — box-shadow using opaque black: rgb(0,0,0) with no alpha
 * channel (defaults to 1) OR an explicit alpha of exactly 1. A soft, low-
 * alpha black shadow (rgba(0,0,0,.1) — the normal elevation-token shape) is
 * NOT flagged; only a fully-opaque black shadow is, since that reads as a
 * harsh pasted-in default rather than a tuned token.
 * @param {string} boxShadow computed `box-shadow`, possibly multi-layer
 */
export function isOpaqueBlackShadow(boxShadow) {
  if (!boxShadow || boxShadow === 'none') return false;
  const layers = boxShadow.match(/rgba?\([^)]*\)/gi) || [];
  return layers.some((layer) => {
    const c = parseRgba(layer);
    return !!c && c.r === 0 && c.g === 0 && c.b === 0 && c.a >= 1;
  });
}

/**
 * Tally `isPureBlackText` across every direct-text element's computed color.
 * @param {string[]} colors
 * @returns {{id:'black-text', count:number, sample:string}|null}
 */
export function classifyBlackText(colors) {
  const hits = (colors || []).filter(isPureBlackText);
  return hits.length ? { id: 'black-text', count: hits.length, sample: hits[0] } : null;
}

/**
 * Tally `isOpaqueBlackShadow` across every element's computed box-shadow.
 * @param {string[]} shadows
 * @returns {{id:'opaque-black-shadow', count:number, sample:string}|null}
 */
export function classifyOpaqueBlackShadow(shadows) {
  const hits = (shadows || []).filter(isOpaqueBlackShadow);
  return hits.length ? { id: 'opaque-black-shadow', count: hits.length, sample: hits[0] } : null;
}

/**
 * OPT-IN tell — single border-radius value shared by every rounded box.
 * TOKEN-AWARE caveat: a page whose `:root` defines `--radius` (the shadcn/ui
 * convention — one radius var drives card/button/input alike) is CORRECT
 * output, not slop — so this classifier is suppressed entirely when
 * `hasRadiusToken` is true. Only flags when there's enough sample size
 * (≥10 rounded boxes) to mean something.
 * @param {Record<string,number>} radii map of rounded-px → occurrence count
 * @param {{hasRadiusToken?:boolean}} [opts]
 * @returns {{id:'radius-monotony', count:number, sample:string}|null}
 */
export function classifyRadiusMonotony(radii, opts = {}) {
  if (opts.hasRadiusToken) return null;
  const entries = Object.entries(radii || {});
  const vals = entries.map(([px]) => Number(px));
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total >= 10 && vals.length === 1) {
    return { id: 'radius-monotony', count: total, sample: `${vals[0]}px` };
  }
  return null;
}

/**
 * OPT-IN tell — two near-identical neutral greys (Manhattan distance ≤9 in
 * rgb) that read as accidental theme inconsistency rather than an
 * intentional scale. TOKEN-AWARE caveat: a candidate whose `fromVar` is true
 * traces back to a declared `:root` custom-property color (a deliberate
 * token, e.g. a declared `--gray-50`/`--gray-100` neutral scale) — the
 * heuristic only compares candidates where NEITHER side of the pair is both
 * from declared tokens, so a correct shadcn neutral scale is not flagged.
 * @param {Array<{rgb:[number,number,number], fromVar:boolean}>} neutrals
 * @returns {{id:'near-duplicate-greys', a:number[], b:number[]}|null}
 */
export function classifyNearDuplicateGreys(neutrals) {
  const list = neutrals || [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (list[i].fromVar && list[j].fromVar) continue; // both are declared tokens — intentional
      const [r1, g1, b1] = list[i].rgb;
      const [r2, g2, b2] = list[j].rgb;
      const d = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      if (d > 0 && d <= 9) {
        return { id: 'near-duplicate-greys', a: list[i].rgb, b: list[j].rgb };
      }
    }
  }
  return null;
}

/**
 * OPT-IN tell — every shadowed element on the page shares exactly ONE
 * distinct box-shadow value, with no resting/hover/overlay elevation
 * hierarchy. TOKEN-AWARE caveat: a single shared button/card shadow IS
 * correct shadcn output when the page genuinely has only one elevation
 * level — this classifier can't tell "one component type" from "flat
 * elevation design", so callers should read it as a prompt to look, not a
 * guaranteed defect (documented false-positive risk).
 * @param {string[]} shadows computed box-shadow values (any element, 'none' filtered)
 * @returns {{id:'single-shadow-stack', sample:string}|null}
 */
export function classifySingleShadowStack(shadows) {
  const distinct = new Set((shadows || []).filter((s) => s && s !== 'none'));
  if (distinct.size === 1) {
    return { id: 'single-shadow-stack', sample: [...distinct][0] };
  }
  return null;
}

/**
 * OPT-IN tell — every padded box on the page shares one padding-top value,
 * i.e. no spatial hierarchy (outer container padding should normally exceed
 * inner element padding). TOKEN-AWARE caveat: this is a coarse heuristic —
 * a small/simple screen can legitimately have one padding step; only flags
 * at ≥10 sampled padded boxes so it needs real repetition to fire.
 * @param {Record<string,number>} pads map of padding-px → occurrence count
 * @returns {{id:'flat-padding', count:number, sample:string}|null}
 */
export function classifyFlatPadding(pads) {
  const entries = Object.entries(pads || {});
  const vals = entries.map(([px]) => Number(px));
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total >= 10 && vals.length === 1) {
    return { id: 'flat-padding', count: total, sample: `${vals[0]}px` };
  }
  return null;
}

/**
 * Run the enabled tell classifiers over one screen's extracted render data
 * and return the findings list. Always advisory — the caller never feeds
 * this into an exit-code decision.
 * @param {object} data as returned by extractTellData()
 * @param {{all?:boolean, enabledOptIn?:string[]}} [opts]
 */
export function computeTellFindings(data, opts = {}) {
  const findings = [];
  const black = classifyBlackText(data.colors);
  if (black) findings.push(black);
  const shadow = classifyOpaqueBlackShadow(data.shadows);
  if (shadow) findings.push(shadow);

  const optIn = opts.all ? OPT_IN_TELL_IDS : (opts.enabledOptIn || []).filter((id) => OPT_IN_TELL_IDS.includes(id));
  if (optIn.includes('radius-monotony')) {
    const f = classifyRadiusMonotony(data.radii, { hasRadiusToken: data.hasRadiusToken });
    if (f) findings.push(f);
  }
  if (optIn.includes('near-duplicate-greys')) {
    const f = classifyNearDuplicateGreys(data.neutrals);
    if (f) findings.push(f);
  }
  if (optIn.includes('single-shadow-stack')) {
    const f = classifySingleShadowStack(data.shadows);
    if (f) findings.push(f);
  }
  if (optIn.includes('flat-padding')) {
    const f = classifyFlatPadding(data.pads);
    if (f) findings.push(f);
  }
  return findings;
}

// =============================================================================
// SELF-TEST — proves the diff logic WITHOUT a live browser (SCOPE §6)
// =============================================================================

function selfTest() {
  let failures = 0;
  const results = [];

  const record = (label, ok) => {
    results.push({ label, ok });
    if (!ok) failures += 1;
  };

  // --- Test 1: within-tolerance signature → PASS -----------------------------
  const baseline1 = [
    { fdl: 'app-shell', box: { x: 0, y: 0, w: 1, h: 1 }, order: 0, display: { display: 'flex' } },
    { fdl: 'sidebar', box: { x: 0, y: 0, w: 0.2, h: 1 }, order: 1, display: { display: 'flex' } },
    { fdl: 'kpi-row', box: { x: 0.22, y: 0.1, w: 0.76, h: 0.15 }, order: 2, display: { display: 'grid' } },
  ];
  const build1Ok = [
    { fdl: 'app-shell', box: { x: 0, y: 0, w: 1, h: 1 }, order: 0, display: { display: 'flex' } },
    { fdl: 'sidebar', box: { x: 0, y: 0.01, w: 0.21, h: 1 }, order: 1, display: { display: 'flex' } },
    { fdl: 'kpi-row', box: { x: 0.23, y: 0.1, w: 0.77, h: 0.16 }, order: 2, display: { display: 'grid' } },
  ];
  const r1 = classifyDiff(baseline1, build1Ok, { posTol: 0.03, sizeTol: 0.05 });
  record('within-tolerance signature → PASS', r1.pass === true && r1.violations.length === 0);

  // --- Test 2: a MOVED anchor beyond posTol → violation, non-pass -----------
  const build2Moved = [
    { fdl: 'app-shell', box: { x: 0, y: 0, w: 1, h: 1 }, order: 0, display: { display: 'flex' } },
    { fdl: 'sidebar', box: { x: 0, y: 0, w: 0.2, h: 1 }, order: 1, display: { display: 'flex' } },
    // kpi-row shifted x by 0.10 (> posTol 0.03)
    { fdl: 'kpi-row', box: { x: 0.32, y: 0.1, w: 0.76, h: 0.15 }, order: 2, display: { display: 'grid' } },
  ];
  const r2 = classifyDiff(baseline1, build2Moved, { posTol: 0.03, sizeTol: 0.05 });
  const movedViolation = r2.violations.find((v) => v.fdl === 'kpi-row' && v.type === 'MOVED');
  record('MOVED anchor beyond posTol → violation detected', r2.pass === false && !!movedViolation);

  // --- Test 3: --report-only forces exit 0 regardless of violations --------
  const exitReportOnly = resolveExitCode('report-only', r2.violations.length > 0);
  record('--report-only exit code is 0 despite violations', exitReportOnly === 0);

  // --- Test 4 (bonus): gate mode exits non-zero on a real violation ---------
  const exitGate = resolveExitCode('gate', r2.violations.length > 0);
  record('gate mode exit code is 1 on a real violation', exitGate === 1);

  // --- Test 5 (bonus): MISSING / EXTRA / REORDERED detection ----------------
  const baseline5 = [
    { fdl: 'topbar', box: { x: 0, y: 0, w: 1, h: 0.08 }, order: 0 },
    { fdl: 'sidebar', box: { x: 0, y: 0.08, w: 0.2, h: 0.92 }, order: 1 },
    { fdl: 'primary-content', box: { x: 0.2, y: 0.08, w: 0.8, h: 0.92 }, order: 2 },
  ];
  const build5 = [
    // primary-content now comes BEFORE sidebar (swapped relative order vs baseline)
    { fdl: 'primary-content', box: { x: 0.2, y: 0.08, w: 0.8, h: 0.92 }, order: 0 },
    { fdl: 'sidebar', box: { x: 0, y: 0.08, w: 0.2, h: 0.92 }, order: 1 },
    { fdl: 'footer', box: { x: 0, y: 0.95, w: 1, h: 0.05 }, order: 2 }, // EXTRA, topbar MISSING
  ];
  const r5 = classifyDiff(baseline5, build5);
  const hasMissing = r5.violations.some((v) => v.fdl === 'topbar' && v.type === 'MISSING');
  const hasExtra = r5.violations.some((v) => v.fdl === 'footer' && v.type === 'EXTRA');
  const hasReorder = r5.violations.some((v) => v.type === 'REORDERED');
  record('MISSING/EXTRA/REORDERED all detected', hasMissing && hasExtra && hasReorder);

  // --- Test 6: pure #000 text IS flagged -------------------------------------
  record('pure #000 text → flagged', isPureBlackText('rgb(0, 0, 0)') === true);

  // --- Test 7: near-black #0a0a0a is NOT flagged -----------------------------
  record('near-black #0a0a0a → not flagged', isPureBlackText('rgb(10, 10, 10)') === false);

  // --- Test 8: opaque-black box-shadow IS flagged ----------------------------
  record(
    'opaque-black shadow → flagged',
    isOpaqueBlackShadow('0px 4px 8px rgb(0, 0, 0)') === true &&
      isOpaqueBlackShadow('0px 4px 8px rgba(0, 0, 0, 1)') === true,
  );

  // --- Test 9: low-alpha rgba(0,0,0,.1) is NOT flagged -----------------------
  record('rgba(0,0,0,.1) shadow → not flagged', isOpaqueBlackShadow('0px 1px 3px rgba(0, 0, 0, 0.1)') === false);

  // --- Test 10: radius-monotony suppressed when --radius token is present ---
  const monotoneRadii = { 6: 14 };
  record(
    'radius-monotony suppressed when --radius present',
    classifyRadiusMonotony(monotoneRadii, { hasRadiusToken: true }) === null &&
      classifyRadiusMonotony(monotoneRadii, { hasRadiusToken: false })?.id === 'radius-monotony',
  );

  // --- Test 11 (bonus): computeTellFindings respects default-vs-all gating --
  const tellData = {
    colors: ['rgb(0, 0, 0)', 'rgb(51, 51, 51)'],
    shadows: ['0px 1px 2px rgba(0, 0, 0, 0.1)', '0px 1px 2px rgba(0, 0, 0, 0.1)'],
    radii: { 8: 12 },
    pads: { 16: 12 },
    neutrals: [{ rgb: [200, 200, 200], fromVar: false }, { rgb: [202, 201, 199], fromVar: false }],
    hasRadiusToken: false,
  };
  const defaultOnly = computeTellFindings(tellData, { enabledOptIn: [] });
  const withAll = computeTellFindings(tellData, { all: true });
  record(
    'computeTellFindings: --tells default finds only black-text (shadow is low-alpha)',
    defaultOnly.length === 1 && defaultOnly[0].id === 'black-text',
  );
  record(
    'computeTellFindings: --tells=all adds radius-monotony/single-shadow-stack/flat-padding/near-dup-greys',
    ['radius-monotony', 'single-shadow-stack', 'flat-padding', 'near-duplicate-greys'].every((id) =>
      withAll.some((f) => f.id === id),
    ),
  );

  // --- Report ---------------------------------------------------------------
  console.log(`\n${CYN}=== design-fidelity.mjs self-test ===${RST}`);
  for (const { label, ok } of results) {
    console.log(`  [${ok ? PASS : FAIL}] ${label}`);
  }
  const overall = failures === 0;
  console.log(`\n${overall ? PASS : FAIL} — ${results.length - failures}/${results.length} assertions passed\n`);
  process.exit(overall ? 0 : 1);
}

// =============================================================================
// PATH HARDENING — clone of sync-context.sh / spec-gap-check.sh guard pattern
// =============================================================================

function hardenRelFile(relFile, projectRoot) {
  if (relFile.startsWith('/')) {
    throw new Error(`--file must be project-relative, not absolute: ${relFile}`);
  }
  if (relFile.split('/').includes('..') || relFile.includes('..')) {
    throw new Error(`--file must not contain '..': ${relFile}`);
  }
  const target = join(projectRoot, relFile);
  const parentDir = dirname(target);
  if (existsSync(parentDir)) {
    const resolvedDir = realpathSync(parentDir);
    if (resolvedDir !== projectRoot && !resolvedDir.startsWith(projectRoot + '/')) {
      throw new Error(`resolved target escapes project root: ${relFile}`);
    }
    // Refuse a symlinked target file that escapes the project root.
    const full = join(resolvedDir, basename(target));
    if (existsSync(full)) {
      const real = realpathSync(full);
      if (real !== projectRoot && !real.startsWith(projectRoot + '/')) {
        throw new Error(`--file is a symlink escaping project root: ${relFile}`);
      }
    }
  } else {
    mkdirSync(parentDir, { recursive: true });
  }
  return target;
}

// =============================================================================
// FILE I/O helpers (best-effort — missing config/baseline is never a crash)
// =============================================================================

function readJsonSafe(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function loadConfig(projectRoot) {
  const cfg = readJsonSafe(join(projectRoot, 'design-fidelity.config.json'));
  return { ...DEFAULT_CONFIG, ...(cfg || {}) };
}

function baselinePathFor(projectRoot, screen) {
  return join(projectRoot, 'docs', 'design-baseline', `${screen}.layout.json`);
}

// =============================================================================
// PLAYWRIGHT-DRIVEN CAPTURE (only touched when a real render is required)
// =============================================================================

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

function resolveUrl(route, config) {
  // Absolute route → verbatim. Relative route → joined onto config.baseUrl.
  // (Raw Playwright page.goto has no baseURL, so a bare "/dashboard" would throw
  // "Cannot navigate to invalid URL" — resolve it here.)
  if (/^https?:\/\//i.test(route)) return route;
  return new URL(route, config.baseUrl).href;
}

async function extractSignature(playwright, route, config) {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    await page.goto(resolveUrl(route, config), { waitUntil: 'networkidle' });
    const signature = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-fdl]'));
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      return els.map((el, i) => {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          fdl: el.getAttribute('data-fdl'),
          box: { x: r.x / vw, y: r.y / vh, w: r.width / vw, h: r.height / vh },
          order: i,
          display: { display: cs.display, flexDirection: cs.flexDirection },
        };
      });
    });
    return signature;
  } finally {
    await browser.close();
  }
}

/**
 * Render one screen's appRoute and extract the raw computed-style records
 * `computeTellFindings()` classifies. Best-effort — any navigation/render
 * failure (no server, unreachable host, bad route) propagates to the caller,
 * which reports it as a single WARN line and skips that screen; it never
 * crashes the run and never touches the exit code (--tells is advisory only).
 * @param {object} playwright the imported 'playwright' module
 * @param {string} route manifest entry's appRoute
 * @param {object} config { baseUrl, viewport }
 */
async function extractTellData(playwright, route, config) {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    await page.goto(resolveUrl(route, config), { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
    await page.waitForTimeout(100);
    return await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
      };
      const isBox = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 20;
      };

      // Declared :root custom-property TOKEN colors (hex/rgb literals only —
      // a property whose value is itself `var(...)` is skipped; it isn't the
      // literal declaration). Used to make radius + grey-scale tells
      // token-aware: a single --radius var, or a declared neutral scale, is
      // correct shadcn/design-system output, not slop.
      const tokenColors = new Set();
      let hasRadiusToken = false;
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin stylesheet — can't introspect, skip
        }
        for (const rule of rules) {
          if (!rule.cssText || !/:root/.test(rule.selectorText || '')) continue;
          const decls = rule.cssText.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
          for (const d of decls) {
            const sep = d.indexOf(':');
            const name = d.slice(0, sep).trim();
            const raw = d.slice(sep + 1).trim();
            if (name === '--radius') hasRadiusToken = true;
            if (/var\(/.test(raw)) continue;
            const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            const rgbm = raw.match(/^rgba?\(([^)]+)\)$/i);
            let rgb = null;
            if (hex) {
              let h = hex[1];
              if (h.length === 3) h = h.split('').map((c) => c + c).join('');
              const n = parseInt(h, 16);
              rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
            } else if (rgbm) {
              const parts = rgbm[1].split(/[,\s/]+/).map(Number).filter((n) => !Number.isNaN(n));
              if (parts.length >= 3) rgb = parts.slice(0, 3);
            }
            if (rgb) tokenColors.add(rgb.join(','));
          }
        }
      }
      if (!hasRadiusToken) {
        hasRadiusToken = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim() !== '';
      }

      const colors = [];
      const shadows = [];
      const radii = {};
      const pads = {};
      const neutrals = [];

      for (const el of document.querySelectorAll('body *')) {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || !isVisible(el)) continue;
        const s = getComputedStyle(el);

        const directText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
        );
        if (directText) colors.push(s.color);

        const bs = s.boxShadow;
        if (bs && bs !== 'none') shadows.push(bs);

        if (isBox(el)) {
          const rad = Math.round(parseFloat(s.borderTopLeftRadius) || 0);
          if (rad > 0.5) radii[rad] = (radii[rad] || 0) + 1;
          const p = Math.round(parseFloat(s.paddingTop) || 0);
          if (p > 0) pads[p] = (pads[p] || 0) + 1;
        }

        const bg = s.backgroundColor || '';
        const m = bg.match(
          /rgba?\(\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)(?:[,\s/]+(-?\d+\.?\d*))?/i,
        );
        if (m) {
          const rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
          const a = m[4] === undefined ? 1 : Number(m[4]);
          if (a > 0.9 && Math.max(...rgb) - Math.min(...rgb) < 16) {
            neutrals.push({ rgb, fromVar: tokenColors.has(rgb.join(',')) });
          }
        }
      }

      return { colors, shadows, radii, pads, neutrals, hasRadiusToken };
    });
  } finally {
    await browser.close();
  }
}

// =============================================================================
// CLI
// =============================================================================

const HELP = `
design-fidelity.mjs — mockup-anchored layout-fidelity gate (deliverable #34)

Usage:
  node scripts/design-fidelity.mjs --update-baseline   Capture baseline FROM the mockup/prototype render
  node scripts/design-fidelity.mjs                      GATE: build vs baseline, exit non-zero on drift
  node scripts/design-fidelity.mjs --report-only        Advisory diff, always exit 0
  node scripts/design-fidelity.mjs --file <relpath>     Target a different manifest.json (path-hardened)
  node scripts/design-fidelity.mjs --self-test          Pure-logic regression, no browser needed
  node scripts/design-fidelity.mjs --tells              ADVISORY render tells: pure-#000 text, opaque-black shadow
  node scripts/design-fidelity.mjs --tells=all           + token-aware opt-ins: radius-monotony, near-dup greys,
                                                          single shadow stack, flat padding (never gates; combinable
                                                          with --report-only, which still only governs the layout gate)
  node scripts/design-fidelity.mjs --help               This message

Exit codes:
  0  clean / advisory / no baseline yet / self-test PASS
  1  gate mode found a real violation / self-test found a regression
  (--tells findings never change the exit code, in any mode)
`;

function parseArgs(argv) {
  const args = {
    mode: 'gate',
    updateBaseline: false,
    selfTest: false,
    help: false,
    manifestRel: DEFAULT_MANIFEST_REL,
    tells: false,
    tellsAll: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--tells') {
      args.tells = true;
      continue;
    }
    if (a.startsWith('--tells=')) {
      args.tells = true;
      args.tellsAll = a.slice('--tells='.length) === 'all';
      continue;
    }
    switch (a) {
      case '--update-baseline':
        args.updateBaseline = true;
        break;
      case '--report-only':
        args.mode = 'report-only';
        break;
      case '--self-test':
        args.selfTest = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--file':
        i += 1;
        if (i >= argv.length) throw new Error('--file requires an argument');
        args.manifestRel = argv[i];
        break;
      default:
        throw new Error(`Unknown flag: ${a}`);
    }
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${RED}Error:${RST} ${e.message}`);
    console.log(HELP);
    process.exit(1);
  }

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.selfTest) {
    selfTest();
    return; // selfTest() calls process.exit() itself
  }

  const projectRoot = realpathSync(process.cwd());

  let manifestPath;
  try {
    manifestPath = hardenRelFile(args.manifestRel, projectRoot);
  } catch (e) {
    console.error(`${RED}Error:${RST} ${e.message}`);
    process.exit(1);
  }

  const manifest = readJsonSafe(manifestPath);
  if (!manifest || Object.keys(manifest).length === 0) {
    console.log(`${YLW}no baseline — run --update-baseline${RST} (no manifest at ${args.manifestRel})`);
    process.exit(0);
  }

  const config = loadConfig(projectRoot);
  const playwright = await loadPlaywright();
  if (!playwright) {
    console.log(
      `${YLW}Playwright is not installed — cannot render screens to check design fidelity.${RST}\n` +
        `  Install it with: npm install -D playwright && npx playwright install chromium\n` +
        `  (advisory only — this run cannot determine drift, so it exits 0)`,
    );
    process.exit(0);
  }

  console.log(`\n${CYN}=== design-fidelity.mjs ===${RST}`);
  console.log(`Manifest : ${args.manifestRel}`);
  console.log(`Mode     : ${args.updateBaseline ? 'update-baseline' : args.mode}`);
  console.log(`Tolerance: posTol=${config.posTol} sizeTol=${config.sizeTol}\n`);

  let anyBaselineMissing = false;
  const allViolations = [];
  let totalTellFindings = 0;
  const optInTellIds = args.tellsAll
    ? OPT_IN_TELL_IDS
    : Array.isArray(config.tells)
      ? config.tells.filter((id) => OPT_IN_TELL_IDS.includes(id))
      : [];

  if (args.tells) {
    console.log(
      `Tells    : ${args.tellsAll ? 'all (default + opt-in)' : 'default' + (optInTellIds.length ? ` + config opt-in [${optInTellIds.join(', ')}]` : '')} — ADVISORY, never gates\n`,
    );
  }

  for (const [screen, entry] of Object.entries(manifest)) {
    if (args.updateBaseline) {
      if (!entry.mockupRoute) {
        console.log(`  [${YLW}SKIP${RST}] ${screen} — manifest entry has no mockupRoute`);
        continue;
      }
      try {
        const signature = await extractSignature(playwright, entry.mockupRoute, config);
        const outPath = baselinePathFor(projectRoot, screen);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, JSON.stringify(signature, null, 2) + '\n');
        console.log(`  [${GRN}CAPTURED${RST}] ${screen} → docs/design-baseline/${screen}.layout.json (${signature.length} anchors)`);
      } catch (e) {
        console.log(`  [${RED}ERROR${RST}] ${screen} — ${e.message}`);
      }
      continue;
    }

    // --tells is independent of the layout-baseline gate below — it renders
    // the SAME entry.appRoute but never affects the exit code, and runs even
    // when no baseline has been captured yet for this screen.
    if (args.tells && entry.appRoute) {
      try {
        const tellData = await extractTellData(playwright, entry.appRoute, config);
        const findings = computeTellFindings(tellData, { all: args.tellsAll, enabledOptIn: optInTellIds });
        if (!findings.length) {
          console.log(`  [${CYN}TELLS${RST}] ${screen} — no measurable design tells`);
        } else {
          for (const f of findings) {
            const sample = f.sample ?? (f.a && f.b ? `rgb(${f.a.join(',')}) vs rgb(${f.b.join(',')})` : '');
            console.log(`  TELL ${f.id} ${f.count ?? 1} e.g. ${sample}`);
          }
          totalTellFindings += findings.length;
        }
      } catch (e) {
        console.log(`  [${YLW}WARN${RST}] ${screen} — tells render failed (${e.message}) — skipped, advisory only`);
      }
    }

    // Gate / report-only mode: diff build vs baseline.
    const baselinePath = baselinePathFor(projectRoot, screen);
    const baseline = readJsonSafe(baselinePath);
    if (!baseline) {
      anyBaselineMissing = true;
      console.log(`  [${YLW}SKIP${RST}] ${screen} — no baseline — run --update-baseline`);
      continue;
    }
    if (!entry.appRoute) {
      console.log(`  [${YLW}SKIP${RST}] ${screen} — manifest entry has no appRoute`);
      continue;
    }
    try {
      const build = await extractSignature(playwright, entry.appRoute, config);
      const { pass, violations } = classifyDiff(baseline, build, config);
      if (pass) {
        console.log(`  [${PASS}] ${screen} — matches mockup layout baseline`);
      } else {
        console.log(`  [${FAIL}] ${screen} — ${violations.length} violation(s):`);
        for (const v of violations) {
          console.log(`      ${v.type.padEnd(10)} ${v.fdl} — ${v.detail}`);
        }
        allViolations.push(...violations.map((v) => ({ screen, ...v })));
      }
    } catch (e) {
      console.log(`  [${RED}ERROR${RST}] ${screen} — ${e.message}`);
    }
  }

  if (args.tells) {
    console.log(
      `\n${CYN}${totalTellFindings} design tell(s) found${RST} across rendered screens — advisory, never gates the exit code.\n`,
    );
  }

  if (args.updateBaseline) {
    console.log(`\n${GRN}Baseline capture complete.${RST} Commit docs/design-baseline/.\n`);
    process.exit(0);
  }

  if (allViolations.length === 0 && anyBaselineMissing) {
    console.log(`\n${YLW}no baseline captured for one or more screens — run --update-baseline${RST}\n`);
    process.exit(0);
  }

  const exitCode = resolveExitCode(args.mode, allViolations.length > 0);
  console.log(
    `\n${exitCode === 0 ? GRN : RED}${allViolations.length} total violation(s)${RST} — mode=${args.mode} — exit ${exitCode}\n`,
  );
  process.exit(exitCode);
}

// Only run the CLI when invoked directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
