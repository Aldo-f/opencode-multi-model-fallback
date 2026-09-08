import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "index.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { node: true, bun: true },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
    ignores: ["node_modules/**", ".opencode/**", "dist/**"],
  },
];
