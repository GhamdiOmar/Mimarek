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
 * Custom rule: `mimaric/require-action-guard` (QA-SEC-01).
 *
 * Every exported async function in a `"use server"` file under
 * `app/actions/**` is a network-reachable POST RPC — anyone who can reach the
 * app can invoke it with attacker-controlled arguments. Each MUST contain a
 * call to one of the recognised auth/authorization guard helpers somewhere in
 * its body, so it cannot run as an unauthenticated/cross-tenant mutation.
 *
 * Guard helpers (any CallExpression to one of these counts):
 *   requirePermission, requireTenantPermission, requireSystem, requireTenant,
 *   getTenantSessionOrThrow, getSessionOrThrow, getSessionWithPermissions,
 *   getTenantPageAccess.
 *
 * Escape hatch for genuinely-public actions (e.g. signup, public marketplace
 * inquiry): an inline `// eslint-disable-next-line mimaric/require-action-guard`
 * on the function — document why it is intentionally unguarded.
 *
 * Surfaces as a WARNING because eslint-plugin-only-warn downgrades errors —
 * that is fine/intended; the value is catching a NEW unguarded action.
 */
const GUARD_HELPERS = new Set([
  "requirePermission",
  "requireTenantPermission",
  "requireSystem",
  "requireTenant",
  "getTenantSessionOrThrow",
  "getSessionOrThrow",
  "getSessionWithPermissions",
  "getTenantPageAccess",
]);

const requireActionGuard = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every exported async function in a app/actions/** \"use server\" file must call an auth/authorization guard helper.",
    },
    messages: {
      noGuard:
        'Exported "use server" action "{{name}}" has no call to an authorization guard ' +
        "(requirePermission / requireTenantPermission / requireSystem / requireTenant / " +
        "getTenantSessionOrThrow / getSessionOrThrow / getSessionWithPermissions / getTenantPageAccess). " +
        "Every exported async fn in a \"use server\" file is a network-reachable POST RPC — guard it, or, " +
        "for a genuinely-public action, add an inline `// eslint-disable-next-line mimaric/require-action-guard` " +
        "with a reason (QA-SEC-01).",
    },
    schema: [],
  },
  create(context) {
    // Only enforce in app/actions/** files. The flat-config `files` glob below
    // already scopes registration, but guard the directory here too so the rule
    // is inert if ever loaded more broadly.
    const filename = context.filename || context.getFilename();
    const normalized = filename.replace(/\\/g, "/");
    const inActions = /\/app\/actions\//.test(normalized);

    let isUseServer = false;

    // Walk a function body for any CallExpression whose callee resolves to a
    // guard helper name (bare `requirePermission(...)` or `x.requirePermission(...)`).
    const bodyHasGuardCall = (fnNode) => {
      const sourceCode = context.sourceCode || context.getSourceCode();
      let found = false;
      const visit = (node) => {
        if (!node || found || typeof node.type !== "string") return;
        if (node.type === "CallExpression") {
          const callee = node.callee;
          if (callee) {
            if (callee.type === "Identifier" && GUARD_HELPERS.has(callee.name)) {
              found = true;
              return;
            }
            if (
              callee.type === "MemberExpression" &&
              callee.property &&
              callee.property.type === "Identifier" &&
              GUARD_HELPERS.has(callee.property.name)
            ) {
              found = true;
              return;
            }
          }
        }
        // Recurse over child nodes / arrays of nodes; skip nested function
        // definitions (a guard inside a nested closure that is never invoked
        // would not protect the action — but in practice guards are called at
        // the top of the action body, so we still descend to be permissive).
        for (const key of Object.keys(node)) {
          if (key === "parent") continue;
          const child = node[key];
          if (Array.isArray(child)) {
            for (const c of child) {
              if (c && typeof c.type === "string") visit(c);
            }
          } else if (child && typeof child.type === "string") {
            visit(child);
          }
        }
      };
      visit(fnNode.body);
      return found;
    };

    const checkExportedFn = (fnNode, nameNode, name) => {
      if (!isUseServer || !inActions) return;
      if (!isAsyncFn(fnNode)) return; // non-async handled by the other rule
      if (bodyHasGuardCall(fnNode)) return;
      context.report({
        node: nameNode || fnNode,
        messageId: "noGuard",
        data: { name: name || "(anonymous)" },
      });
    };

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
        if (!isUseServer || !inActions) return;
        const d = node.declaration;
        if (!d) return; // `export { ... }` specifier lists out of scope
        if (d.type === "FunctionDeclaration" && d.async) {
          checkExportedFn(d, d.id, d.id && d.id.name);
        } else if (d.type === "VariableDeclaration") {
          for (const decl of d.declarations) {
            if (isAsyncFn(decl.init)) {
              checkExportedFn(
                decl.init,
                decl.id,
                decl.id && decl.id.type === "Identifier" ? decl.id.name : undefined,
              );
            }
          }
        }
      },
      ExportDefaultDeclaration(node) {
        if (!isUseServer || !inActions) return;
        if (isAsyncFn(node.declaration)) {
          checkExportedFn(node.declaration, null, "default");
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
          // QA-SEC-01: every exported "use server" action under app/actions/**
          // must call an authorization guard helper.
          "require-action-guard": requireActionGuard,
        },
      },
    },
    rules: {
      "mimaric/no-non-async-export-in-use-server": "error",
      "mimaric/require-action-guard": "error",
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
        {
          // CX-013 / §6.6.4: no native confirm()/alert() — use the governed
          // <ConfirmDialog> primitive (or a toast/banner) so destructive
          // confirmations are bilingual, RTL-safe, and consistent.
          selector:
            "CallExpression[callee.name='confirm'], CallExpression[callee.object.name='window'][callee.property.name='confirm']",
          message:
            "Don't hand-roll confirm()/window.confirm() — use <ConfirmDialog> from @repo/ui (AGENTS.md §6.6 / CX-013).",
        },
        {
          selector:
            "CallExpression[callee.name='alert'], CallExpression[callee.object.name='window'][callee.property.name='alert']",
          message:
            "Never use alert()/window.alert() — use a toast, banner, or <ConfirmDialog> from @repo/ui (AGENTS.md §6.6.4).",
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
      // CX-010 bulk import: writes pre-encrypted Customer rows via createMany
      // (encryptCustomerData) — the deliberate, documented third PII creator.
      "app/actions/customer-import.ts",
      "**/e2e/**",
      "**/scripts/**",
      "**/seed.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
];
