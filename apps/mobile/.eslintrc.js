module.exports = {
  extends: ["../../.eslintrc.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/strict-boolean-expressions": "off",
  },
};
