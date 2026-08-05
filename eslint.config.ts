import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["src-tauri/**", "dist/**", "__tests__/**", "src/test/**"] },
  {
    files: ["src/**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ["src/**/*.{ts,mts,cts,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-unused-vars": "off", "no-undef": "off" }
  },
  {
    files: ["src/**/*.{ts,mts,cts,tsx}"],
    ...tseslint.configs.recommended[0],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ...pluginReact.configs.flat.recommended,
    rules: { "react/react-in-jsx-scope": "off" }
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error"
    }
  },
]);
