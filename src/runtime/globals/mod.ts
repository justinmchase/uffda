import { add } from "./add.ts";
import { checksum } from "./checksum.ts";
import { coalesce } from "./coalesce.ts";
import { document_id } from "./document_id.ts";
import { eq } from "./eq.ts";
import { enumerate } from "./enumerate.ts";
import { filter } from "./filter.ts";
import { flat } from "./flat.ts";
import { format } from "./format.ts";
import { from_entries } from "./from_entries.ts";
import { has } from "./has.ts";
import { id } from "./id.ts";
import { int } from "./int.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { last } from "./last.ts";
import { map } from "./map.ts";
import { match_leaf_offset } from "./match_leaf_offset.ts";
import { not } from "./not.ts";
import { one } from "./one.ts";
import { pack } from "./pack.ts";
import { pluck } from "./pluck.ts";
import { source_document } from "./source_document.ts";
import { to_set } from "./to_set.ts";
import { units } from "./units.ts";
import { when } from "./when.ts";

/**
 * Default runtime globals available to ExpressionLang invocations.
 *
 * Prefer general-purpose helpers here (`flat`, `join`, `one`, …).
 *
 * B6/B7 also registered source/tokenizer domain helpers as bootstrap
 * precursors so language modules can convert without Native. Several of those
 * (`source_document`, `units`, `semantic_texts`, …) are provisional in this
 * map; the intended long-term home is author-defined `func` declarations
 * (https://github.com/justinmchase/uffda/issues/124). Do not grow more
 * stack-specific globals without considering that path.
 */
export const defaultGlobals = new Map<string, unknown>([
  ["add", add],
  ["checksum", checksum],
  ["coalesce", coalesce],
  ["document_id", document_id],
  ["eq", eq],
  ["enumerate", enumerate],
  ["filter", filter],
  ["flat", flat],
  ["format", format],
  ["from_entries", from_entries],
  ["has", has],
  ["id", id],
  ["int", int],
  ["join", join],
  ["json", json],
  ["last", last],
  ["map", map],
  ["match_leaf_offset", match_leaf_offset],
  ["not", not],
  ["one", one],
  ["pack", pack],
  ["pluck", pluck],
  ["source_document", source_document],
  ["to_set", to_set],
  ["units", units],
  ["when", when],
]);

export { isMatchAware, markMatchAware, MATCH_AWARE } from "./match_aware.ts";
