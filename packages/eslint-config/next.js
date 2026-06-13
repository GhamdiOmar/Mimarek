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
 * Custom rule: in a file whose first directive is `"use server"`, every export
 * must be an async function. A non-async-function export (e.g.
 * `export const x = unstable_cache(...)`, a plain object, or a sync function)
 * collapses the route's entire Server Action bundle at runtime — and `tsc` /
 * Playwright do NOT catch it (AGENTS.md §4 landmine, hit in v4.7.0). The fix is
 * to move such values into a server-only module (e.g. `lib/server/*`).
 */
const isAsyncFn = (n) =>
  !!n &&
  (n.type === "ArrowFunctionExpression" ||
    n.type === "FunctionExpression" ||
    n.type === "FunctionDeclaration") &&
  n.async === true;

const noNonAsyncExportInUseServer = {
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow non-async-function exports in a "use server" file.',
    },
    messages: {
      nonAsync:
        'A "use server" file may only export async functions. Move this value to a ' +
        "server-only module (e.g. lib/server/*) and import it where needed — see AGENTS.md §4.",
    },
    schema: [],
  },
  create(context) {
    let isUseServer = false;
    return {
      Program(node) {
        const first = node.body[0];
        isUseServer =
          !!first &&
          first.type === "ExpressionStatement" &&
          first.expression.type === "Literal" &&
          first.expression.value === "use server";
      },
      ExportNamedDeclaration(node) {
        if (!isUseServer) return;
        const d = node.declaration;
        if (!d) return; // `export { ... }` specifier lists are out of scope
        if (d.type === "FunctionDeclaration") {
          if (!d.async) context.report({ node: d, messageId: "nonAsync" });
        } else if (d.type === "VariableDeclaration") {
          for (const decl of d.declarations) {
            if (!isAsyncFn(decl.init)) {
              context.report({ node: decl, messageId: "nonAsync" });
            }
          }
        }
        // TS type/interface declarations are erased at build — allowed.
      },
      ExportDefaultDeclaration(node) {
        if (!isUseServer) return;
        if (!isAsyncFn(node.declaration)) {
          context.report({ node: node.declaration, messageId: "nonAsync" });
        }
      },
    };
  },
};

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
  // ─────────────────────────────────────────────────────────────────────────
  // Mimaric data-integrity guardrails (AGENTS.md §4, §6) — v4.18.0
  //
  // (a) PII write path: a fresh Customer must be created through the canonical
  //     encrypt path (encryptCustomerData) so phone/email/nationalId land
  //     encrypted with their blind-index hashes. Banning customer.create /
  //     customer.upsert outside the two canonical modules mechanizes the P1-1
  //     marketplace-plaintext-PII landmine. `update` is NOT banned — existing
  //     update sites write only status, never PII.
  // (b) no-non-async-export-in-use-server: mechanizes the §4 v4.7.0 landmine.
  //
  // Both are "error" intent but surface as warnings (only-warn, see above).
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      mimaric: {
        rules: {
          "no-non-async-export-in-use-server": noNonAsyncExportInUseServer,
        },
      },
    },
    rules: {
      "mimaric/no-non-async-export-in-use-server": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(create|upsert|createMany)$/][callee.object.property.name='customer']",
          message:
            "Create customers through app/actions/customers.ts (encryptCustomerData) so PII is " +
            "encrypted with blind-index hashes — never write Customer rows directly. Marketplace " +
            "inquiries use the helper in marketplace.ts. See AGENTS.md §4/§6.",
        },
      ],
    },
  },
  {
    // Canonical PII-write modules + test/seed/repair scripts are exempt: the
    // encrypt path itself lives here, and seeds intentionally write fixtures.
    files: [
      "app/actions/customers.ts",
      "app/actions/marketplace.ts",
      "**/e2e/**",
      "**/scripts/**",
      "**/seed.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
];
