/**
 * Style Dictionary config — Orqafy Design Token Pipeline (V32.8 Rule 31)
 *
 * Source:  tokens/src/orqafy.tokens.json  (DTCG format)
 * Outputs: tokens/build/generated-tokens.css   — CSS custom properties
 *          tokens/build/tokens.d.ts             — TypeScript token map
 *
 * Run via:
 *   npm run design:validate   → validate DTCG source format
 *   npm run design:build      → generate CSS + TS outputs
 *   npm run design:check      → compare generated output vs committed baseline
 *
 * NOTE: This project currently uses CSS variables directly in globals.css as
 * the primary implementation (the shadcn/ui pattern). This pipeline is the
 * V32.8 design-contract scaffold — it validates that the token source matches
 * the live globals.css and produces type-safe references for components.
 *
 * globals.css is the source of truth for deployed values; tokens/src/*.json
 * is the design-contract source for validation and future token builds.
 */

/** @type {import('style-dictionary').Config} */
export default {
  source: ["tokens/src/**/*.tokens.json"],
  platforms: {
    css: {
      transformGroup: "css",
      prefix: "sd",
      buildPath: "tokens/build/",
      files: [
        {
          destination: "generated-tokens.css",
          format: "css/variables",
          options: {
            outputReferences: false,
            selector: ":root[data-token-build]",
          },
        },
      ],
    },
    ts: {
      transformGroup: "js",
      buildPath: "tokens/build/",
      files: [
        {
          destination: "tokens.d.ts",
          format: "typescript/module-declarations",
        },
      ],
    },
  },
};
