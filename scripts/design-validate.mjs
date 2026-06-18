#!/usr/bin/env node
/**
 * design-validate.mjs — V32.8 Rule 31 Design-as-Contract validator
 *
 * Purpose: Validates that the DTCG token source (tokens/src/) is internally
 * consistent and that the shadcn CSS variable values in globals.css match
 * the color tokens in the design contract.
 *
 * Invoked via: npm run design:validate
 * Exit 0 = valid, Exit 1 = validation failures found.
 *
 * What this checks:
 *   1. Token source file exists and is valid JSON
 *   2. All color tokens use hsl(H S% L%) format (not legacy R G B)
 *   3. Required tokens are present (shadcn minimal set)
 *   4. globals.css CSS variable values match the token source values
 *      (tolerance: whitespace differences allowed; semantic equivalence check)
 *
 * Assumption: globals.css lives at apps/web/src/app/globals.css (relative to
 * the monorepo root where this script runs).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Paths ──────────────────────────────────────────────────────────────────

const TOKEN_SOURCE = resolve(ROOT, "tokens/src/orqafy.tokens.json");
const GLOBALS_CSS  = resolve(ROOT, "apps/web/src/app/globals.css");

// ── Required token keys (must be present in .color section) ───────────────

const REQUIRED_COLOR_TOKENS = [
  "background", "foreground",
  "primary", "primary-foreground",
  "secondary", "secondary-foreground",
  "muted", "muted-foreground",
  "accent", "accent-foreground",
  "destructive", "destructive-foreground",
  "border", "input", "ring",
  "brand-muted", "surface",
];

// ── CSS variable → token name map ─────────────────────────────────────────
// Maps --css-var-name to the DTCG color token key.
// Used to cross-check globals.css values against token source.

const CSS_VAR_TO_TOKEN = {
  "--background":            "background",
  "--foreground":            "foreground",
  "--primary":               "primary",
  "--primary-foreground":    "primary-foreground",
  "--secondary":             "secondary",
  "--muted":                 "muted",
  "--muted-foreground":      "muted-foreground",
  "--accent":                "accent",
  "--destructive":           "destructive",
  "--border":                "border",
  "--input":                 "input",
  "--ring":                  "ring",
  "--brand-muted":           "brand-muted",
  "--surface":               "surface",
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Normalize an HSL value string for comparison.
 *  "hsl(0 0% 3.9%)" → "0 0% 3.9%"
 *  "0 0% 3.9%"      → "0 0% 3.9%"  (already bare — shadcn CSS var format)
 */
function normalizeHsl(raw) {
  return raw.trim()
    .replace(/^hsl\(\s*/i, "")
    .replace(/\s*\)$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse --css-var: value; pairs from a CSS string (inside :root {}). */
function parseCssVars(css) {
  const vars = {};
  // Match inside :root { ... } block
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/s);
  if (!rootMatch) return vars;
  const block = rootMatch[1];
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

// ── Validation ─────────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

// 1. Token source exists
if (!existsSync(TOKEN_SOURCE)) {
  errors.push(`Token source not found: ${TOKEN_SOURCE}`);
  printResult(errors, warnings);
  process.exit(1);
}

// 2. Token source is valid JSON
let tokens;
try {
  tokens = JSON.parse(readFileSync(TOKEN_SOURCE, "utf8"));
} catch (e) {
  errors.push(`Token source is not valid JSON: ${e.message}`);
  printResult(errors, warnings);
  process.exit(1);
}

// 3. Color section exists
if (!tokens.color || typeof tokens.color !== "object") {
  errors.push("Token source missing top-level 'color' section.");
}

// 4. Required tokens present
for (const key of REQUIRED_COLOR_TOKENS) {
  if (!tokens.color?.[key]) {
    errors.push(`Required color token missing: color.${key}`);
  }
}

// 5. All color token $values use hsl() format (not legacy R G B)
if (tokens.color) {
  for (const [key, token] of Object.entries(tokens.color)) {
    if (key === "$type") continue;
    if (typeof token !== "object" || !token.$value) continue;
    const val = String(token.$value);
    // Must be hsl(...) format
    if (!val.startsWith("hsl(")) {
      errors.push(
        `color.${key}: $value must use hsl() format, got: "${val}". ` +
        `(Legacy R G B format is deprecated — see DESIGN.md §shadcn Translation Guide)`
      );
    }
  }
}

// 6. globals.css cross-check
if (!existsSync(GLOBALS_CSS)) {
  warnings.push(`globals.css not found at ${GLOBALS_CSS} — skipping CSS cross-check.`);
} else {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const cssVars = parseCssVars(css);

  for (const [cssVar, tokenKey] of Object.entries(CSS_VAR_TO_TOKEN)) {
    const cssVal = cssVars[cssVar];
    const tokenVal = tokens.color?.[tokenKey]?.$value;

    if (!cssVal) {
      errors.push(`globals.css missing ${cssVar} (expected from token ${tokenKey})`);
      continue;
    }
    if (!tokenVal) continue; // already caught above

    // shadcn CSS vars are bare "H S% L%" (no hsl() wrapper)
    // token values are "hsl(H S% L%)"
    const normalizedCss   = normalizeHsl(cssVal);
    const normalizedToken = normalizeHsl(String(tokenVal));

    if (normalizedCss !== normalizedToken) {
      errors.push(
        `MISMATCH: ${cssVar} in globals.css = "${cssVal}" ` +
        `but token color.${tokenKey}.$value = "${tokenVal}". ` +
        `Normalized: "${normalizedCss}" vs "${normalizedToken}".`
      );
    }
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

printResult(errors, warnings);
process.exit(errors.length > 0 ? 1 : 0);

function printResult(errors, warnings) {
  const tag = "[design:validate]";
  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`${tag} WARN: ${w}`);
  }
  if (errors.length > 0) {
    console.error(`${tag} FAILED — ${errors.length} error(s):\n`);
    for (const e of errors) console.error(`  ✖ ${e}`);
    console.error(`\nFix the errors above, then re-run: npm run design:validate`);
  } else {
    console.log(`${tag} OK — token source valid, globals.css values match (${Object.keys(CSS_VAR_TO_TOKEN).length} vars cross-checked)`);
  }
}
