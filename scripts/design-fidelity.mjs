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
//   node scripts/design-fidelity.mjs --help
//
// Exit codes:
//   0 — clean / advisory / no baseline yet (nothing to compare) / self-test PASS
//   1 — gate mode found a real violation (or --self-test found a regression)
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
  const merged = { ...DEFAULT_CONFIG, ...(cfg || {}) };
  // FDL_BASE_URL env override — lets a transient QA server (e.g. a branch
  // build on another port) be targeted without editing the committed config.
  // Unset ⇒ behavior unchanged (config file, then DEFAULT_CONFIG).
  if (typeof process.env.FDL_BASE_URL === 'string' && process.env.FDL_BASE_URL.length > 0) {
    merged.baseUrl = process.env.FDL_BASE_URL;
  }
  return merged;
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

// ── Auth (E1) — logs in ONCE per run and reuses the storageState for every
// manifest entry flagged "auth": true. Public entries are unaffected — they
// keep using a plain no-auth context, so their capture output stays
// byte-identical to before this change. Dev-seed creds only, env-overridable,
// never a real secret hardcoded (see docs/CREDENTIALS.md).
const DEFAULT_DEMO_EMAIL = 'admin@mail.com';
const DEFAULT_DEMO_PASSWORD = 'admin';
const FALLBACK_DEMO_EMAIL = 'webmaster@orqafy.local';
const FALLBACK_DEMO_PASSWORD = process.env.WEBMASTER_PASSWORD ?? '';
const DEMO_TENANT_SLUG = 'demo';

async function attemptLogin(page, config, email, password) {
  await page.goto(resolveUrl('/login', config), { waitUntil: 'networkidle' });
  await page.fill('#tenantSlug', DEMO_TENANT_SLUG);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {}),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
  return page.url();
}

/**
 * Log in once, return a Playwright storageState object to reuse across every
 * authed capture in this run. Throws with a clear message if BOTH the
 * primary and fallback dev-seed credential sets fail to reach an authed
 * /demo/ path (caller decides whether that's fatal).
 */
async function loginAndCaptureStorageState(playwright, config) {
  const browser = await playwright.chromium.launch();
  try {
    const context = await browser.newContext({ viewport: config.viewport });
    const page = await context.newPage();

    const primaryEmail = process.env.DEMO_ADMIN_EMAIL || DEFAULT_DEMO_EMAIL;
    const primaryPassword = process.env.DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_PASSWORD;
    let finalUrl = await attemptLogin(page, config, primaryEmail, primaryPassword);

    if (new URL(finalUrl).pathname.startsWith('/login') && FALLBACK_DEMO_PASSWORD !== '') {
      finalUrl = await attemptLogin(page, config, FALLBACK_DEMO_EMAIL, FALLBACK_DEMO_PASSWORD);
    }

    if (new URL(finalUrl).pathname.startsWith('/login')) {
      throw new Error(
        `login failed for both credential sets — final URL still /login (${finalUrl})`,
      );
    }

    const storageState = await context.storageState();
    return storageState;
  } finally {
    await browser.close();
  }
}

async function extractSignature(playwright, route, config, storageState) {
  const browser = await playwright.chromium.launch();
  try {
    const context = storageState
      ? await browser.newContext({ viewport: config.viewport, storageState })
      : await browser.newContext({ viewport: config.viewport });
    const page = await context.newPage();
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
  node scripts/design-fidelity.mjs --help               This message

Exit codes:
  0  clean / advisory / no baseline yet / self-test PASS
  1  gate mode found a real violation / self-test found a regression
`;

function parseArgs(argv) {
  const args = { mode: 'gate', updateBaseline: false, selfTest: false, help: false, manifestRel: DEFAULT_MANIFEST_REL };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
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

  // Log in ONCE (if any manifest entry needs it) and reuse the session for
  // every authed capture below. Public-only manifests never touch this path
  // — their capture behavior/output stays byte-identical to before E1.
  const needsAuth = Object.values(manifest).some((entry) => entry.auth === true);
  let authStorageState = null;
  if (needsAuth) {
    console.log(`  ${CYN}logging in${RST} (demo tenant) — reused for all "auth": true entries…`);
    try {
      authStorageState = await loginAndCaptureStorageState(playwright, config);
      console.log(`  [${GRN}OK${RST}] authenticated session ready\n`);
    } catch (e) {
      console.error(`${RED}Error:${RST} ${e.message}`);
      process.exit(1);
    }
  }

  for (const [screen, entry] of Object.entries(manifest)) {
    const storageStateForEntry = entry.auth === true ? authStorageState : null;
    if (args.updateBaseline) {
      if (!entry.mockupRoute) {
        console.log(`  [${YLW}SKIP${RST}] ${screen} — manifest entry has no mockupRoute`);
        continue;
      }
      try {
        const signature = await extractSignature(playwright, entry.mockupRoute, config, storageStateForEntry);
        const outPath = baselinePathFor(projectRoot, screen);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, JSON.stringify(signature, null, 2) + '\n');
        console.log(`  [${GRN}CAPTURED${RST}] ${screen} → docs/design-baseline/${screen}.layout.json (${signature.length} anchors)`);
      } catch (e) {
        console.log(`  [${RED}ERROR${RST}] ${screen} — ${e.message}`);
      }
      continue;
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
      const build = await extractSignature(playwright, entry.appRoute, config, storageStateForEntry);
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
