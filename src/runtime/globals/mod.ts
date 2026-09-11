import { add } from "./add.ts";
import { at } from "./at.ts";
import { base58 } from "./base58.ts";
import { coalesce } from "./coalesce.ts";
import { compare } from "./compare.ts";
import { eq } from "./eq.ts";
import { enumerate } from "./enumerate.ts";
import { filter } from "./filter.ts";
import { flat } from "./flat.ts";
import { format } from "./format.ts";
import { from_entries } from "./from_entries.ts";
import { gt } from "./gt.ts";
import { gte } from "./gte.ts";
import { has } from "./has.ts";
import { id } from "./id.ts";
import { int } from "./int.ts";
import { iterable } from "./iterable.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { last } from "./last.ts";
import { length } from "./length.ts";
import { lt } from "./lt.ts";
import { lte } from "./lte.ts";
import { map } from "./map.ts";
import { match_leaf_offset } from "./match_leaf_offset.ts";
import { not } from "./not.ts";
import { one } from "./one.ts";
import { pack } from "./pack.ts";
import { pluck } from "./pluck.ts";
import { reduce } from "./reduce.ts";
import { scan } from "./scan.ts";
import { sha256 } from "./sha256.ts";
import { slice } from "./slice.ts";
import { sub } from "./sub.ts";
import { symbol } from "./symbol.ts";
import { to_set } from "./to_set.ts";
import { when } from "./when.ts";

/**
 * Default runtime globals available to ExpressionLang invocations.
 *
 * Prefer general-purpose helpers here (`flat`, `join`, `one`, …).
 *
 * B6/B7 also registered source/tokenizer domain helpers as bootstrap
 * precursors so language modules can convert without Native. Several of those
 * (`match_leaf_offset`, …) are provisional in this map; the
 * intended long-term home is author-defined `func` declarations
 * (https://github.com/justinmchase/uffda/issues/124). Do not grow more
 * stack-specific globals without considering that path.
 */
export const defaultGlobals = new Map<string, unknown>([
  ["add", add],
  ["at", at],
  ["base58", base58],
  ["coalesce", coalesce],
  ["compare", compare],
  ["eq", eq],
  ["enumerate", enumerate],
  ["filter", filter],
  ["flat", flat],
  ["format", format],
  ["from_entries", from_entries],
  ["gt", gt],
  ["gte", gte],
  ["has", has],
  ["id", id],
  ["int", int],
  ["iterable", iterable],
  ["join", join],
  ["json", json],
  ["last", last],
  ["length", length],
  ["lt", lt],
  ["lte", lte],
  ["map", map],
  ["match_leaf_offset", match_leaf_offset],
  ["not", not],
  ["one", one],
  ["pack", pack],
  ["pluck", pluck],
  ["reduce", reduce],
  ["scan", scan],
  ["sha256", sha256],
  ["slice", slice],
  ["sub", sub],
  ["symbol", symbol],
  ["to_set", to_set],
  ["when", when],
]);

export { isMatchAware, markMatchAware, MATCH_AWARE } from "./match_aware.ts";
