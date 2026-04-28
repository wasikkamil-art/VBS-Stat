import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // Pliki ignorowane
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "functions/lib/**",
      "functions/node_modules/**",
      "public/**",
      ".vercel/**",
      ".firebase/**",
      // Skrypty utility/one-shot (zgodnie z .gitignore)
      "fix_*.js",
      "import_*.js",
      "diagnose_*.js",
      "audit-all.js",
      "migrate_*.js",
      "impersonate_*.js",
    ],
  },

  // Frontend src/ — React + Vite
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        L: "readonly", // Leaflet via CDN (per CLAUDE.md gotcha)
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // === Vite + React 18 specifics ===
      "react/react-in-jsx-scope": "off",       // JSX auto-transform (per CLAUDE.md)
      "react/jsx-uses-react": "off",            // JSX auto-transform
      "react/prop-types": "off",                // No PropTypes używane w projekcie
      "react/no-unescaped-entities": "off",     // Polskie cudzysłowy w UI
      "react/display-name": "off",              // Inline components są OK

      // === Bug-catching rules (priority — komercjalizacja) ===
      "no-undef": "error",                       // Literówki w nazwach (jak rozladunekFirma${i})
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",                   // Ignoruj nieużyty `e` w try/catch
      }],
      "no-dupe-keys": "error",                   // Duplicate keys w obiektach
      "no-unreachable": "error",                 // Dead code po return/throw
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",     // String z ${...} bez backticków (np. "Hello ${name}")
      "no-loss-of-precision": "error",
      "use-isnan": "error",
      "valid-typeof": "error",

      // === Hooks rules ===
      // rules-of-hooks = realne bugi (hooks warunkowo). Inne hooks v7 reguły są agresywne
      // (set-state-in-effect, static-components, purity, immutability) — często false
      // positive w istniejącym monolicie App.jsx. Warn = info, nie blokuje.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",

      // === Style — niskopriorytetowe (warn) ===
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-extra-semi": "warn",
      "no-irregular-whitespace": "warn",

      // === Off — zbyt głośne dla istniejącego kodu ===
      "no-console": "off",                       // 87 console.* w kodzie, OK do usuwania stopniowo
      "react/jsx-key": "warn",                   // Trzeba sprawdzić ale nie blocking
      "react/no-unknown-property": "off",        // jsxRuntime + niektóre style attribute
      "no-mixed-spaces-and-tabs": "off",
      "react-refresh/only-export-components": "off", // Monolityczny App.jsx — nie ma sensu na razie
    },
  },

  // Backend Cloud Functions — Node.js
  {
    files: ["functions/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
      "no-undef": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off",                       // logger.log w functions OK
    },
  },

  // Vercel API routes — Node.js (api/)
  {
    files: ["api/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
];
