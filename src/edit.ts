import type { Path } from "./path.ts";

/**
 * Describes a single edit applied to a previously-parsed input, in terms of
 * the (pre-edit) stream position it occurred at and how many items were
 * removed/inserted there. See
 * `.agents/specifications/runtime/incremental-parsing.spec.md` for the
 * normative "edit" and "affected region" definitions this type models.
 *
 * v1 scope: `at` MUST be a flat/single-segment path (a position in the
 * outermost layer's linear stream). `removed`/`inserted` are recorded for
 * documentation and future position-remapping use; v1's reuse logic only
 * consults `at` to determine which prior memo entries are unaffected by the
 * edit (anything ending at or before `at` is reusable, anything else is
 * discarded and reparsed from scratch).
 */
export type Edit = {
  at: Path;
  removed: number;
  inserted: number;
};
