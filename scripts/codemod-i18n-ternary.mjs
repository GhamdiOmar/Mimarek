// scripts/codemod-i18n-ternary.mjs
//
// F1 — Deterministic inline-ternary → t() migration (ts-morph).
//
// Converts  `lang === "ar" ? <AR> : <EN>`  into  `t(<AR>, <EN>)`.
// This is EXACTLY behavior-preserving because the LanguageProvider facade is:
//     t = (ar, en) => (lang === "ar" ? ar : en)
// so the conversion is a pure rename of the same expression — IFF we only ever
// touch true string-literal copy pairs. Under-converting is correct; a wrong
// conversion is a bug. When in any doubt: SKIP and tally as skipped-ambiguous.
//
// Usage:
//   node scripts/codemod-i18n-ternary.mjs            # DRY RUN (no writes)
//   node scripts/codemod-i18n-ternary.mjs --apply    # WRITE changes
//
// Targets apps/web TSX/TS source. Per file it prints {converted, skipped, no-t}.

import { Project, SyntaxKind, Node } from "ts-morph";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APPLY = process.argv.includes("--apply");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");

// Control tokens that are direction/locale plumbing, NEVER human copy.
const CONTROL_TOKEN = /^(rtl|ltr|en|ar|en-US|ar-SA|en-SA)$/;

// JSX attributes whose value is plumbing, never copy.
const PLUMBING_ATTR = new Set([
  "dir",
  "lang",
  "locale",
  "className",
  "dirName",
  "calendar",
]);

// Call expressions whose ternary argument is locale plumbing, never copy.
// Matched against the *last* identifier of the callee (e.g. toLocaleString).
const LOCALE_CALLEE = /^(toLocaleString|toLocaleDateString|toLocaleTimeString|toLocaleLowerCase|toLocaleUpperCase|DateTimeFormat|NumberFormat|format|formatToParts)$/;
const INTL_OBJECT = /^(Intl|DateTimeFormat|NumberFormat)$/;

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

/** Is the test exactly `lang === "ar"` ? */
function isLangArTest(test) {
  if (!Node.isBinaryExpression(test)) return false;
  if (test.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken)
    return false;
  const left = test.getLeft();
  const right = test.getRight();
  if (!Node.isIdentifier(left) || left.getText() !== "lang") return false;
  if (!Node.isStringLiteral(right) || right.getLiteralValue() !== "ar")
    return false;
  return true;
}

/** Plain string literal or no-substitution template — the easy case. */
function isPlainStringLike(node) {
  return (
    Node.isStringLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node)
  );
}

/** A simple interpolation expression: identifier or chained property access. */
function isSimpleInterp(expr) {
  if (Node.isIdentifier(expr)) return true;
  if (Node.isPropertyAccessExpression(expr)) {
    // walk the chain; every link must be id / property-access only
    let cur = expr;
    while (Node.isPropertyAccessExpression(cur)) {
      cur = cur.getExpression();
    }
    return Node.isIdentifier(cur) || cur.getKind() === SyntaxKind.ThisKeyword;
  }
  return false;
}

/**
 * For a TemplateExpression, return the ordered list of interpolation source
 * texts IFF every interpolation is "simple". Returns null if any interpolation
 * is non-simple (a call, ternary, binary, etc.) — caller then SKIPS.
 */
function templateInterpShape(node) {
  if (!Node.isTemplateExpression(node)) return null;
  const shapes = [];
  for (const span of node.getTemplateSpans()) {
    const expr = span.getExpression();
    if (!isSimpleInterp(expr)) return null;
    shapes.push(expr.getText());
  }
  return shapes;
}

/** Multiset equality of two string arrays. */
function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * Decide whether BOTH branches are convertible copy. Returns true only for:
 *  - both plain string-like, OR
 *  - both TemplateExpression with identical-shaped simple interpolations.
 * Plus the control-token reject on any plain-string branch value.
 */
function branchesAreConvertibleCopy(whenTrue, whenFalse) {
  // Reject control tokens on either plain-string branch.
  for (const b of [whenTrue, whenFalse]) {
    if (Node.isStringLiteral(b) || Node.isNoSubstitutionTemplateLiteral(b)) {
      const v = b.getLiteralValue();
      if (CONTROL_TOKEN.test(v)) return false;
    }
  }

  const tPlain = isPlainStringLike(whenTrue);
  const fPlain = isPlainStringLike(whenFalse);

  // Case A: both plain string-like.
  if (tPlain && fPlain) return true;

  // Case B: both template expressions with matching simple-interp shape.
  const tShape = templateInterpShape(whenTrue);
  const fShape = templateInterpShape(whenFalse);
  if (tShape && fShape && sameMultiset(tShape, fShape)) return true;

  // Mixed (one plain, one template) — be safe, allow ONLY if the plain side is
  // a string and the template has zero interpolations is impossible here
  // (zero-interp templates are NoSubstitutionTemplateLiteral, already plain).
  // So any remaining mixed case is ambiguous → reject.
  return false;
}

/**
 * Is this conditional expression in a context we must NOT touch?
 *  - value of a plumbing JSX attribute (dir/lang/locale/className/...)
 *  - argument to an Intl / toLocale* call
 */
function isInForbiddenContext(cond) {
  let node = cond;
  // climb out of parentheses
  let parent = node.getParent();
  while (parent && Node.isParenthesizedExpression(parent)) {
    node = parent;
    parent = node.getParent();
  }
  if (!parent) return false;

  // JSX attribute: <X attr={ cond } />  →  parent is JsxExpression, grandparent JsxAttribute
  if (Node.isJsxExpression(parent)) {
    const gp = parent.getParent();
    if (gp && Node.isJsxAttribute(gp)) {
      const attrName = gp.getNameNode().getText();
      if (PLUMBING_ATTR.has(attrName)) return true;
    }
  }

  // Call argument: foo.toLocaleString( cond, ... ) or Intl.NumberFormat(cond)
  if (Node.isCallExpression(parent)) {
    const callee = parent.getExpression();
    const calleeText = callee.getText();
    // last segment of a property-access chain
    const lastSeg = calleeText.split(".").pop() ?? calleeText;
    if (LOCALE_CALLEE.test(lastSeg)) return true;
    // Intl.DateTimeFormat / Intl.NumberFormat (new or call)
    if (/\bIntl\.(DateTimeFormat|NumberFormat|Collator|ListFormat|RelativeTimeFormat|PluralRules)\b/.test(calleeText))
      return true;
    if (INTL_OBJECT.test(lastSeg)) return true;
  }
  // new Intl.NumberFormat( cond )
  if (Node.isNewExpression(parent)) {
    const calleeText = parent.getExpression().getText();
    if (/\bIntl\.(DateTimeFormat|NumberFormat|Collator|ListFormat|RelativeTimeFormat|PluralRules)\b/.test(calleeText))
      return true;
  }

  return false;
}

/** Ensure `t` is in the `useLanguage()` destructure. Returns false if no useLanguage destructure exists. */
/**
 * The scope-defining ancestor kinds we treat as a function boundary.
 * A `useLanguage()` destructure inside one of these is reachable by any
 * descendant of that same node.
 */
const FUNCTION_SCOPE_KINDS = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
]);

/** Nearest enclosing function-scope node for `node` (or the SourceFile). */
function enclosingFunctionScope(node) {
  let cur = node.getParent();
  while (cur) {
    if (FUNCTION_SCOPE_KINDS.has(cur.getKind())) return cur;
    cur = cur.getParent();
  }
  return node.getSourceFile();
}

/**
 * Collect every `useLanguage()` object-destructure in the file.
 * Returns an array of { decl, scope, hasT } where `scope` is the function node
 * that owns the binding (so descendants of `scope` can see `t`).
 */
function collectUseLanguageDestructures(sourceFile) {
  const out = [];
  for (const vd of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const init = vd.getInitializer();
    if (!init || !Node.isCallExpression(init)) continue;
    if (init.getExpression().getText() !== "useLanguage") continue;
    const nameNode = vd.getNameNode();
    if (!Node.isObjectBindingPattern(nameNode)) continue; // `const x = useLanguage()` — not usable
    const hasT = nameNode
      .getElements()
      .some((el) => el.getNameNode().getText() === "t");
    out.push({ nameNode, scope: enclosingFunctionScope(vd), hasT });
  }
  return out;
}

/**
 * Module-/file-level NON-facade `t` bindings that would collide with adding `t`
 * to a useLanguage destructure: a top-level `const t = <translation object>`
 * (the `const t = {ar,en}; t[lang]` pattern) or an imported `t`. These live at
 * a scope that encloses the whole component, so ADDING `t` to a destructure
 * would shadow them and break `t[lang]`. When present we never add `t`; a site
 * is then convertible ONLY if it already has facade-`t` in its destructure.
 */
function hasFileLevelConflictingT(sourceFile) {
  // top-level const/let/var t = <not useLanguage()>  (skip nested ones — those
  // are handled by per-site shadow detection)
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getNameNode();
      if (Node.isIdentifier(name) && name.getText() === "t") {
        const init = decl.getInitializer();
        const isFacade =
          init &&
          Node.isCallExpression(init) &&
          init.getExpression().getText() === "useLanguage";
        if (!isFacade) return true;
      }
    }
  }
  // import { t } / import t from …
  for (const imp of sourceFile.getImportDeclarations()) {
    const def = imp.getDefaultImport();
    if (def && def.getText() === "t") return true;
    for (const named of imp.getNamedImports()) {
      const alias = named.getAliasNode()?.getText() ?? named.getNameNode().getText();
      if (alias === "t") return true;
    }
  }
  return false;
}

/**
 * Per-site shadow check. A binding named `t` shadows the facade at `site` iff
 * the binding's enclosing lexical region is an ANCESTOR of `site` (so the site
 * is lexically inside the shadowing scope) AND that region is a strict
 * descendant of the destructure `scope` (the binding is *between* the facade
 * and the use). Covers callback params (`.map((t) => …)`) and nested `const t`.
 * Returns true if any such shadow exists (→ skip just this site).
 *
 * Correctness note: a `const t`/param `t` in a SIBLING region (e.g. a different
 * effect or helper that does NOT contain the site) does NOT shadow the site —
 * the ancestry test rules those out, which is why a timer-handle `const t`
 * inside one effect never blocks conversions elsewhere in the component.
 */
function siteHasShadowingT(site, scope) {
  const siteAncestors = new Set();
  {
    let c = site.getParent();
    while (c) {
      siteAncestors.add(c);
      c = c.getParent();
    }
  }
  // scope must be a site ancestor (guaranteed by reachableDestructure), so we
  // only care about `t` bindings whose enclosing region is a site-ancestor that
  // is a strict descendant of scope.

  // 1) function/arrow parameters named `t` whose function body encloses site.
  for (const fn of scope.getDescendantsOfKind(SyntaxKind.ArrowFunction)
    .concat(scope.getDescendantsOfKind(SyntaxKind.FunctionExpression))
    .concat(scope.getDescendantsOfKind(SyntaxKind.FunctionDeclaration))
    .concat(scope.getDescendantsOfKind(SyntaxKind.MethodDeclaration))) {
    if (fn === scope) continue;
    if (!siteAncestors.has(fn)) continue; // fn does not enclose the site → no shadow
    for (const p of fn.getParameters()) {
      if (bindingNameIncludes(p.getNameNode(), "t")) return true;
    }
  }

  // 2) local `const/let/var t` whose enclosing block/region encloses site.
  for (const vd of scope.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const n = vd.getNameNode();
    if (!Node.isIdentifier(n) || n.getText() !== "t") continue;
    // The binding's scope is its nearest enclosing Block (or arrow concise body
    // region). If that block is an ancestor of the site, it shadows.
    const block = vd.getFirstAncestorByKind(SyntaxKind.Block);
    if (block && siteAncestors.has(block)) return true;
    // Also a SourceFile-level `t` (handled by hasFileLevelConflictingT already).
  }

  return false;
}

/** Does a binding name (identifier or pattern) bind the given name? */
function bindingNameIncludes(nameNode, target) {
  if (Node.isIdentifier(nameNode)) return nameNode.getText() === target;
  // object/array binding patterns
  for (const el of nameNode.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    if (el.getNameNode().getText() === target) return true;
  }
  return false;
}

/** Add `t` to a useLanguage destructure name node if missing. */
function addTToDestructure(nameNode) {
  const text = nameNode.getText(); // e.g. "{ lang }"
  const inner = text.slice(1, -1).trim();
  const rebuilt = inner.length ? `{ t, ${inner} }` : `{ t }`;
  nameNode.replaceWithText(rebuilt);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const project = new Project({
  tsConfigFilePath: path.join(WEB_ROOT, "tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

// Restrict to apps/web source (the tsconfig already globs **/*.tsx + **/*.ts).
const allFiles = project
  .getSourceFiles()
  .filter((sf) => {
    const fp = sf.getFilePath();
    return (
      fp.includes("/apps/web/") &&
      !fp.includes("/node_modules/") &&
      !fp.endsWith(".d.ts")
    );
  });

let totalConverted = 0;
let totalSkippedAmbiguous = 0;
let totalRevertedNoT = 0;
const filesSkippedNoT = [];
const perFile = [];

for (const sf of allFiles) {
  let converted = 0;
  let skipped = 0;
  let revertedNoT = 0;

  // Scope analysis: where is a facade-`t` reachable, and would adding one collide?
  const destructures = collectUseLanguageDestructures(sf);
  const fileLevelConflictT = hasFileLevelConflictingT(sf);

  /**
   * For a candidate ternary, find a useLanguage destructure whose owning scope
   * is an ancestor of the ternary. Returns the matching destructure record or
   * null. The nearest such ancestor wins (so a component-body destructure
   * covers all of its JSX, but a sibling module helper is NOT covered).
   */
  function reachableDestructure(node) {
    // Build the set of ancestor nodes once.
    const ancestors = new Set();
    let cur = node.getParent();
    while (cur) {
      ancestors.add(cur);
      cur = cur.getParent();
    }
    // The destructure's *owning scope* must be one of our ancestors (or be the
    // SourceFile, which is everyone's ancestor) AND the destructure declaration
    // itself must lexically precede the use (it always does for a hook at the
    // top of the component, which is the only shape we accept).
    let best = null;
    for (const d of destructures) {
      const scope = d.scope;
      if (scope.getKind() === SyntaxKind.SourceFile || ancestors.has(scope)) {
        // Prefer the deepest scope (closest ancestor) for correctness.
        if (best == null || scope.getStart() > best.scope.getStart()) {
          best = d;
        }
      }
    }
    return best;
  }

  // Collect candidate conditionals (deepest-first so inner nodes replace before
  // outer ones, keeping the AST consistent across replacements).
  const conds = sf
    .getDescendantsOfKind(SyntaxKind.ConditionalExpression)
    .filter((c) => isLangArTest(c.getCondition()));
  conds.sort((a, b) => b.getStart() - a.getStart());

  // Decide each candidate. We resolve reachability BEFORE any mutation so the
  // ancestor/scope nodes are still valid; we record the destructure to update.
  const toConvert = []; // { cond, destructure }
  const destructuresToGetT = new Set();
  for (const cond of conds) {
    if (cond.wasForgotten()) continue;
    const whenTrue = cond.getWhenTrue();
    const whenFalse = cond.getWhenFalse();

    if (isInForbiddenContext(cond)) {
      skipped++;
      continue;
    }
    if (!branchesAreConvertibleCopy(whenTrue, whenFalse)) {
      skipped++;
      continue;
    }

    const d = reachableDestructure(cond);
    if (!d) {
      // No facade-t reachable from this site (module helper, local useState
      // `lang`, prop `lang`, server fn, etc.). Do NOT fabricate a t.
      revertedNoT++;
      continue;
    }
    if (!d.hasT && fileLevelConflictT) {
      // `t` is reachable only by ADDING it to the destructure, but the file
      // has a file-level non-facade `t` (e.g. `const t = {ar,en}` object or an
      // imported `t`) — adding would shadow it and break `t[lang]`. Refuse.
      revertedNoT++;
      continue;
    }
    // Per-site shadow check: even with facade-t available at the destructure
    // scope, an intervening callback param / local `const t` between the site
    // and that scope would shadow it. Skip such sites.
    if (siteHasShadowingT(cond, d.scope)) {
      revertedNoT++;
      continue;
    }
    toConvert.push({ cond, destructure: d });
    if (!d.hasT) destructuresToGetT.add(d);
  }

  // Perform replacements.
  for (const { cond } of toConvert) {
    if (cond.wasForgotten()) continue;
    const arText = cond.getWhenTrue().getText();
    const enText = cond.getWhenFalse().getText();
    cond.replaceWithText(`t(${arText}, ${enText})`);
    converted++;
  }

  // Ensure `t` is destructured where we relied on adding it.
  for (const d of destructuresToGetT) {
    if (d.nameNode.wasForgotten()) continue;
    addTToDestructure(d.nameNode);
  }

  totalConverted += converted;
  totalSkippedAmbiguous += skipped;
  totalRevertedNoT += revertedNoT;
  if (revertedNoT > 0 && converted === 0) {
    filesSkippedNoT.push(path.relative(REPO_ROOT, sf.getFilePath()));
  }

  if (converted > 0 || skipped > 0 || revertedNoT > 0) {
    perFile.push({
      file: path.relative(REPO_ROOT, sf.getFilePath()),
      converted,
      skipped,
      revertedNoT,
    });
  }
}

// ---------------------------------------------------------------------------
// Report + (optionally) write
// ---------------------------------------------------------------------------

perFile.sort((a, b) => b.converted - a.converted);
console.log(`\n=== ${APPLY ? "APPLY" : "DRY RUN"} — per-file ===`);
for (const r of perFile) {
  const flag = r.revertedNoT ? `  [REVERTED-NO-T:${r.revertedNoT}]` : "";
  console.log(
    `  ${r.file}  converted=${r.converted} skipped-ambiguous=${r.skipped}${flag}`,
  );
}

console.log(`\n=== TOTALS ===`);
console.log(`  files touched (converted>0):  ${perFile.filter((r) => r.converted > 0).length}`);
console.log(`  total converted:              ${totalConverted}`);
console.log(`  total skipped-ambiguous:      ${totalSkippedAmbiguous}`);
console.log(`  total reverted (no-t files):  ${totalRevertedNoT}`);
console.log(`  files skipped (no t / no destructure): ${filesSkippedNoT.length}`);
for (const f of filesSkippedNoT) console.log(`      - ${f}`);

if (APPLY) {
  project.saveSync();
  console.log(`\n[APPLIED] saved ${perFile.filter((r) => r.converted > 0).length} files.`);
} else {
  console.log(`\n[DRY RUN] no files written. Re-run with --apply to write.`);
}
