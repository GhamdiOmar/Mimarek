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
      reexport:
        'A "use server" file may not re-export from another module (`export { … } from`, ' +
        "`export type { … } from`, or `export * from`). Turbopack mis-lowers the re-export into a " +
        "runtime binding and collapses the Server Action bundle (the D1 RetentionTable 500). " +
        "Import the symbol where it is consumed instead — see AGENTS.md §4.",
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
        // Re-exports (`export { x } from "…"`, `export type { x } from "…"`) carry a
        // `source`. Turbopack lowers them into a runtime binding inside a "use server"
        // file, collapsing the whole Server Action bundle. Ban them regardless of
        // exportKind (value OR type). A local specifier list (`export { f }`, no
        // `source`) stays out of scope — `f` is a local async fn declared above.
        if (node.source) {
          context.report({ node, messageId: "reexport" });
          return;
        }
        const d = node.declaration;
        if (!d) return; // local `export { ... }` specifier lists are out of scope
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
      ExportAllDeclaration(node) {
        // `export * from "…"` (and `export * as ns from "…"`) — same Turbopack hazard.
        if (!isUseServer) return;
        context.report({ node, messageId: "reexport" });
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
 * Surfaces as an "error" (v4.33.0 H7 ratchet removed eslint-plugin-only-warn) —
 * a NEW unguarded action fails lint/CI; pre-existing ones live in eslint-suppressions.json.
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
 * Custom rule: `mimaric/no-raw-revalidate-path` (C1 — shared-seam adoption).
 *
 * Bans `revalidatePath("/dashboard...")` / `revalidatePath("/portal...")` with a
 * raw string-literal path in `app/actions/**`. Route paths must come from the
 * `ROUTES` registry (lib/routes.ts) or its `routeTo*` helpers so a route rename
 * is a single edit — a stray literal silently keeps pointing at a deleted route
 * and ships a stale cache (AGENTS.md §8.5 stale-rename hazard). Dynamic
 * (template-literal) paths are unaffected; use a `routeTo*` helper for those.
 */
const noRawRevalidatePath = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw string-literal app paths in revalidatePath(...) inside app/actions/** — use ROUTES from lib/routes.ts.",
    },
    messages: {
      rawPath:
        'Don\'t pass a raw path string to revalidatePath("{{path}}"). Import ROUTES (or a routeTo* ' +
        "helper) from lib/routes.ts and call revalidatePath(ROUTES.x) so a route rename is one edit " +
        "and never leaves a stale-cache literal behind (AGENTS.md §8.5 / C1).",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const inActions = /\/app\/actions\//.test(filename.replace(/\\/g, "/"));
    return {
      "CallExpression[callee.name='revalidatePath']"(node) {
        if (!inActions) return;
        const first = node.arguments[0];
        if (
          first &&
          first.type === "Literal" &&
          typeof first.value === "string" &&
          (first.value.startsWith("/dashboard") || first.value.startsWith("/portal"))
        ) {
          context.report({ node: first, messageId: "rawPath", data: { path: first.value } });
        }
      },
    };
  },
};

/**
 * Custom rule: `mimaric/no-inline-json-serialize` (C1 — shared-seam adoption).
 *
 * Bans the inline `JSON.parse(JSON.stringify(x))` Decimal/Date-stripping idiom in
 * `app/actions/**`. There is one seam — `serialize()` (lib/serialize.ts); inlining
 * the round-trip scatters the same brittle pattern across ~24 files and hides the
 * single place it could be hardened. Use `serialize(x)` (keep any `as T` cast).
 */
const noInlineJsonSerialize = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow inline JSON.parse(JSON.stringify(...)) in app/actions/** — use serialize() from lib/serialize.ts.",
    },
    messages: {
      inlineSerialize:
        "Don't inline JSON.parse(JSON.stringify(x)) — import { serialize } from lib/serialize.ts and " +
        "call serialize(x) (the one Decimal/Date-safe seam). Keep any `as T` cast (AGENTS.md / C1).",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const inActions = /\/app\/actions\//.test(filename.replace(/\\/g, "/"));
    return {
      // Outer JSON.parse( JSON.stringify(...) ) call.
      "CallExpression[callee.object.name='JSON'][callee.property.name='parse']"(node) {
        if (!inActions) return;
        const arg = node.arguments[0];
        if (
          arg &&
          arg.type === "CallExpression" &&
          arg.callee &&
          arg.callee.type === "MemberExpression" &&
          arg.callee.object &&
          arg.callee.object.type === "Identifier" &&
          arg.callee.object.name === "JSON" &&
          arg.callee.property &&
          arg.callee.property.type === "Identifier" &&
          arg.callee.property.name === "stringify"
        ) {
          context.report({ node, messageId: "inlineSerialize" });
        }
      },
    };
  },
};

/**
 * Custom rule: `mimaric/label-has-associated-control` (a11y label sweep — F-A11Y).
 *
 * Flags form-input controls that have NO programmatic label association — the
 * WCAG 1.3.1 (Info and Relationships) / 4.1.2 (Name, Role, Value) gap that axe
 * surfaces as `label`. The repo deliberately does NOT use eslint-plugin-jsx-a11y
 * (see the NOTE block below), so this is a hand-written `mimaric/*` detector that
 * matches the established rule style (closure state, Program/Program:exit pass).
 *
 * This is the DETECTOR for the label sweep; its WARN output is the work-list.
 * Ratchet to "error" only after the backlog is fixed in batches.
 *
 * A control is in scope if its JSX name is one of CONTROL_NAMES, OR it is a
 * native `<input>` (except the non-text input types) / native `<textarea>`.
 *
 * A control is considered LABELLED (not flagged) if ANY of:
 *   1. It carries `aria-label` / `aria-labelledby` (any value).
 *   2. It carries a `label` prop (some primitives self-label).
 *   3. Its `id` string-literal matches a `<label htmlFor="...">` string-literal
 *      that appears ANYWHERE in the same file; OR (best-effort, non-literal)
 *      its `id={expr}` and SOME label's `htmlFor={expr}` reference the same
 *      identifier name (covers `id={fieldId}` + `htmlFor={fieldId}`).
 *   4. It is a JSX descendant of a `<Field>` element (Field wires id+label via
 *      its render-prop).
 *   5. It is spread with a Field render-prop param (`{...field}` / `{...f}` /
 *      `{...fieldProps}`).
 *
 * `<SelectField>` is governed and self-labelling — it is SKIPPED entirely (not a
 * control we check), as are non-input controls (Button, IconButton, Switch,
 * Checkbox, native select/option).
 *
 * Reporting is deferred to `Program:exit` so labels that appear AFTER the control
 * in source order are still matched (order-independent).
 */
const CONTROL_NAMES = new Set([
  "Input",
  "SaudiPhoneInput",
  "CRInput",
  "NationalIdInput",
  "SARAmountInput",
  "HijriDatePicker",
]);

// Native inputs of these types are not labellable text controls — skip them.
const NON_TEXT_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "image",
  "reset",
]);

// Spread argument identifiers that signal a Field render-prop param.
const FIELD_SPREAD_NAMES = new Set(["field", "f", "fieldProps"]);

// Get a JSX attribute node by name from an opening element.
const getJsxAttr = (openingElement, name) => {
  for (const attr of openingElement.attributes || []) {
    if (attr.type === "JSXAttribute" && attr.name && attr.name.name === name) {
      return attr;
    }
  }
  return undefined;
};

// Does the opening element have a (Field) render-prop spread, e.g. {...field}?
const hasFieldSpread = (openingElement) => {
  for (const attr of openingElement.attributes || []) {
    if (
      attr.type === "JSXSpreadAttribute" &&
      attr.argument &&
      attr.argument.type === "Identifier" &&
      FIELD_SPREAD_NAMES.has(attr.argument.name)
    ) {
      return true;
    }
  }
  return false;
};

// Resolve a JSX element's opening-element tag name (Identifier only; member
// expressions like <Foo.Bar> are out of scope for our control/Field checks).
const jsxName = (openingElement) => {
  const n = openingElement && openingElement.name;
  return n && n.type === "JSXIdentifier" ? n.name : undefined;
};

// Is this opening element an in-scope control we must check for a label?
const isControlElement = (openingElement) => {
  const name = jsxName(openingElement);
  if (!name) return false;
  if (CONTROL_NAMES.has(name)) return true;
  if (name === "textarea") return true;
  if (name === "input") {
    // Native <input> — skip non-text types (hidden/submit/button/image/reset).
    const typeAttr = getJsxAttr(openingElement, "type");
    if (
      typeAttr &&
      typeAttr.value &&
      typeAttr.value.type === "Literal" &&
      typeof typeAttr.value.value === "string" &&
      NON_TEXT_INPUT_TYPES.has(typeAttr.value.value)
    ) {
      return false;
    }
    return true;
  }
  return false;
};

// Walk up node.parent chain; true if any JSXElement ancestor is a <Field>.
const isInsideField = (openingElement) => {
  let cur = openingElement.parent; // the JSXElement for this control
  while (cur) {
    if (
      cur.type === "JSXElement" &&
      cur.openingElement &&
      jsxName(cur.openingElement) === "Field"
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
};

const labelHasAssociatedControl = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every form-input control must have a programmatic label association (id↔<label htmlFor>, a <Field> wrapper, or aria-label) — WCAG 1.3.1/4.1.2.",
    },
    messages: {
      noLabel:
        "Form control <{{name}}> has no associated label. Add an `id` matched by a " +
        "`<label htmlFor>`, wrap it in `<Field label=…>`, or give it an `aria-label` " +
        "so it has an accessible name (AGENTS.md §6.7 / WCAG 1.3.1 — fixes axe `label`).",
    },
    schema: [],
  },
  create(context) {
    // Collected per file at Program; reset on each new Program node.
    const labelHtmlForLiterals = new Set(); // <label htmlFor="literal">
    const labelHtmlForIdentifiers = new Set(); // <label htmlFor={ident}>
    const candidates = []; // { node (openingElement), name }

    const reset = () => {
      labelHtmlForLiterals.clear();
      labelHtmlForIdentifiers.clear();
      candidates.length = 0;
    };

    // Does this control have a string-literal id matching a label htmlFor literal,
    // or an identifier-expression id matching a label htmlFor identifier?
    const idMatchesSomeLabel = (openingElement) => {
      const idAttr = getJsxAttr(openingElement, "id");
      if (!idAttr || !idAttr.value) return false;
      // id="literal"
      if (
        idAttr.value.type === "Literal" &&
        typeof idAttr.value.value === "string"
      ) {
        return labelHtmlForLiterals.has(idAttr.value.value);
      }
      // id={expr} — best-effort: a bare identifier expression `id={fieldId}`.
      if (idAttr.value.type === "JSXExpressionContainer") {
        const expr = idAttr.value.expression;
        if (expr && expr.type === "Identifier") {
          return labelHtmlForIdentifiers.has(expr.name);
        }
      }
      return false;
    };

    const isLabelled = (openingElement) => {
      // 1. aria-label / aria-labelledby (any value).
      if (
        getJsxAttr(openingElement, "aria-label") ||
        getJsxAttr(openingElement, "aria-labelledby")
      ) {
        return true;
      }
      // 2. self-labelling `label` prop.
      if (getJsxAttr(openingElement, "label")) return true;
      // 5. Field render-prop spread ({...field}).
      if (hasFieldSpread(openingElement)) return true;
      // 4. descendant of <Field>.
      if (isInsideField(openingElement)) return true;
      // 3. id ↔ <label htmlFor> association.
      if (idMatchesSomeLabel(openingElement)) return true;
      return false;
    };

    return {
      Program() {
        reset();
      },
      // Collect every <label>'s htmlFor target (literal value + identifier name).
      "JSXOpeningElement"(node) {
        const name = jsxName(node);
        if (name === "label") {
          const htmlFor = getJsxAttr(node, "htmlFor");
          if (htmlFor && htmlFor.value) {
            if (
              htmlFor.value.type === "Literal" &&
              typeof htmlFor.value.value === "string"
            ) {
              labelHtmlForLiterals.add(htmlFor.value.value);
            } else if (htmlFor.value.type === "JSXExpressionContainer") {
              const expr = htmlFor.value.expression;
              if (expr && expr.type === "Identifier") {
                labelHtmlForIdentifiers.add(expr.name);
              }
            }
          }
          return;
        }
        // Defer the labelled-or-not decision to Program:exit, because labels may
        // appear AFTER the control in source order. Collect candidate controls now.
        if (isControlElement(node)) {
          candidates.push({ node, name });
        }
      },
      "Program:exit"() {
        for (const { node, name } of candidates) {
          if (!isLabelled(node)) {
            context.report({ node, messageId: "noLabel", data: { name } });
          }
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
  // Mimarek governed-clickable guardrails (AGENTS.md §6.6)
  // Prevents reintroducing banned clickable anti-patterns.
  //
  // NOTE ON SEVERITY (v4.33.0 — H7 ratchet): eslint-plugin-only-warn was REMOVED.
  // These rules are real "error"s now — a NEW violation fails CI. The pre-existing
  // backlog is carried in the committed apps/web/eslint-suppressions.json
  // (`eslint --suppress-all`); shrink it with `npm run lint:prune`. A clean CI run
  // therefore means every governed rule passed (no silent warn-downgrade).
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
            {
              // C1: raw <select> is banned — use the governed <SelectField> from
              // @repo/ui so labels, ids, RTL, and error state are consistent
              // (B1 already removed every raw select; this keeps them gone).
              element: "select",
              message:
                "Use <SelectField> from @repo/ui instead of a raw <select> so the field " +
                "label/id wiring, RTL, and validation state stay governed (AGENTS.md §6.7 / C1).",
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
  // Mimarek data-integrity guardrails (AGENTS.md §4, §6) — v4.18.0
  //
  // (a) PII write path: a fresh Customer must be created through the canonical
  //     encrypt path (encryptCustomerData) so phone/email/nationalId land
  //     encrypted with their blind-index hashes. Banning customer.create /
  //     customer.upsert outside the two canonical modules mechanizes the P1-1
  //     marketplace-plaintext-PII landmine. `update` is NOT banned — existing
  //     update sites write only status, never PII.
  // (b) no-non-async-export-in-use-server: mechanizes the §4 v4.7.0 landmine.
  //
  // Both are real "error"s now (v4.33.0 H7 ratchet removed eslint-plugin-only-warn) —
  // a NEW violation fails CI; the pre-existing backlog lives in eslint-suppressions.json.
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
          // C1 shared-seam adoption: force ROUTES + serialize() in app/actions/**.
          "no-raw-revalidate-path": noRawRevalidatePath,
          "no-inline-json-serialize": noInlineJsonSerialize,
          // F-A11Y: form controls must have a programmatic label (WCAG 1.3.1).
          // WARN (not error) — surface the backlog first, fix in batches, then
          // ratchet to "error".
          "label-has-associated-control": labelHasAssociatedControl,
        },
      },
    },
    rules: {
      "mimaric/no-non-async-export-in-use-server": "error",
      "mimaric/require-action-guard": "error",
      "mimaric/no-raw-revalidate-path": "error",
      "mimaric/no-inline-json-serialize": "error",
      "mimaric/label-has-associated-control": "warn",
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
  {
    // H7 ratchet (v4.33.0): eslint-plugin-only-warn was removed so lint genuinely
    // gates. These two rules were "warn" in the recommended presets; bump to "error"
    // so any NEW violation fails CI. The existing backlog is carried by the committed
    // `eslint-suppressions.json` (generated via `eslint --suppress-all`); prune it with
    // `eslint --prune-suppressions` as the backlog shrinks, then delete it when empty.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];
