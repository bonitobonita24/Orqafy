/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' },
    ],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    '.turbo/',
    'coverage/',
    '*.mjs',
    // shadcn/ui installed components — auto-generated, not project-authored
    'apps/web/src/components/ui/',
    // Real-file `.js` shims re-exporting their `.ts` sibling — required so native
    // Node ESM resolution (no bundler) finds a real file for `@orqafy/shared`'s
    // Node16-style `.js` relative specifiers. Not part of any tsconfig project
    // (type-aware linting would fail), and not meant to be authored/linted —
    // see packages/shared/src/rbac/features.js for the full explanation.
    'packages/shared/src/rbac/*.js',
  ],
  settings: {},
};
