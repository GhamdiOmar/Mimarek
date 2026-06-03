import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Mimaric governed-clickable guardrails (AGENTS.md §6.6)
  // Prevents reintroducing banned clickable anti-patterns.
  //
  // NOTE ON SEVERITY: eslint-plugin-only-warn (included in base.js) downgrades
  // all "error" severity violations to "warn" at the Linter level, so these
  // rules show as warnings in CLI output but remain "error" in config intent.
  // CI stays green (0 errors); violations are visible and tracked as warnings.
  //
  // NOTE ON jsx-a11y: eslint-plugin-jsx-a11y is not installed in this package.
  // Per project instructions, jsx-a11y rules are not added here. Install
  // eslint-plugin-jsx-a11y in packages/eslint-config and re-enable the
  // commented rules below when ready.
  // ─────────────────────────────────────────────────────────────────────────
  {
    // Apply forbid-elements to all app files.
    // packages/ui uses react-internal config (not next-js), so its raw <button>
    // primitives (Button.tsx, IconButton.tsx, etc.) are never reached by this rule.
    files: ["**/*.tsx", "**/*.jsx"],
    rules: {
      // Rule 1: Forbid raw <button> — use <Button> or <IconButton> from @repo/ui.
      // Escape hatch: add the comment below on the line before a legitimate
      // raw <button role="switch"> (semantic toggle switch):
      //   {/* eslint-disable-next-line react/forbid-elements -- semantic toggle switch (role=switch); see AGENTS.md §6.6 */}
      "react/forbid-elements": [
        "error",
        {
          forbid: [
            {
              element: "button",
              message:
                "Use <Button> or <IconButton> from @repo/ui instead of a raw <button>. " +
                "Exception: semantic toggle switches (<button role=\"switch\">) may suppress this rule with an inline eslint-disable comment referencing AGENTS.md §6.6.",
            },
          ],
        },
      ],

      // Rules 2-5 (jsx-a11y) — UNAVAILABLE: eslint-plugin-jsx-a11y not installed.
      // Install eslint-plugin-jsx-a11y in packages/eslint-config, then uncomment:
      //
      // Rule 2: icon-only controls must have an accessible label.
      // "jsx-a11y/control-has-associated-label": "error",
      //
      // Rule 3: anchors must have valid href (raise to error).
      // "jsx-a11y/anchor-is-valid": "error",
      //
      // Rules 4-5: pre-existing backlog — set to warn until cleared.
      // TODO(a11y): ratchet no-static-element-interactions + click-events-have-key-events
      //             to "error" once the existing violations in shell/topbar/sidebar are fixed.
      // "jsx-a11y/no-static-element-interactions": "warn",
      // "jsx-a11y/click-events-have-key-events": "warn",
    },
  },
];
