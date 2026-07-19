// Real-file shim — DO NOT DELETE. See features.js in this directory for the
// full explanation: TypeScript's Node16/NodeNext resolution rewrites the
// `.js` specifier in rbac/index.ts back to `./actions.ts` for typechecking,
// but a real Node ESM loader (no bundler) needs an actual `actions.js` file
// on disk to satisfy `export * from './actions.js'` at runtime.
export * from './actions.ts';
