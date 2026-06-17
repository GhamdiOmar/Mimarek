/**
 * A bilingual string. Arabic is primary per the RTL-first design system.
 *
 * Structurally identical to `@repo/types` `LocalizedText`, but declared *here*
 * so `@repo/ui` stays decoupled from `@repo/types` (no workspace-dependency or
 * build-config change). This is `@repo/ui`'s own copy of the structural
 * contract — producers type their data with `@repo/types`; the shapes are
 * assignable. Previously this 2-line interface was re-declared inline in five
 * Journey components (LifecycleRail, NextActionPanel, ProcessBlockerBanner,
 * RelatedContextPanel, RoleTaskQueue); they now import it from here.
 */
export interface LocalizedText {
  ar: string;
  en: string;
}
