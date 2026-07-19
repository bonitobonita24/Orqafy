// Real-file shim — DO NOT DELETE.
//
// packages/shared ships source-only (no build step); its package.json "type"
// is "module" and rbac/index.ts re-exports this module as `./features.js`
// (required so @orqafy/db's Node16/NodeNext typecheck resolves the specifier —
// see commit 24a618c). TypeScript's Node16/NodeNext resolution rewrites a
// `.js` specifier back to the sibling `.ts` file for TYPE-CHECKING, so this
// file is invisible to tsc (features.ts stays the source of truth there).
//
// But a REAL Node ESM loader (no bundler) resolves specifiers literally —
// `./features.js` must be an actual file on disk. Without this shim, any
// dynamic `import('@orqafy/shared/rbac')` executed by compiled CJS output
// (e.g. packages/db/src/seed/role-permissions.ts, which cannot statically
// import an ESM package from CommonJS) fails at runtime with
// ERR_MODULE_NOT_FOUND — including in the worker's production process
// (`node dist/index.js`, no bundler, no tsx).
//
// This file exists purely so that literal specifier resolves to something
// real. Node 22.18+ / 24+ natively type-strips `.ts` files it is explicitly
// asked to load, so re-exporting the actual `.ts` source works everywhere.
export * from './features.ts';
