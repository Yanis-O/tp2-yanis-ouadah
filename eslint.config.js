import js from "@eslint/js";
import tseslint from "typescript-eslint";

// INFRA-212 : regles recommandees JS + TypeScript, plus quelques regles qui attrapent
// les bugs vus dans ce depot (comparaison laxiste, debugger oublie).
export default tseslint.config(
  { ignores: ["node_modules/", "coverage/", "reports/", ".stryker-tmp/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {
      eqeqeq: ["error", "always"],
      "no-debugger": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-nocheck": true, "ts-ignore": true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
