import { add } from "./add.ts";
import { coalesce } from "./coalesce.ts";
import { eq } from "./eq.ts";
import { filter } from "./filter.ts";
import { flat } from "./flat.ts";
import { format } from "./format.ts";
import { from_entries } from "./from_entries.ts";
import { has } from "./has.ts";
import { id } from "./id.ts";
import { int } from "./int.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { map } from "./map.ts";
import { not } from "./not.ts";
import { one } from "./one.ts";
import { pack } from "./pack.ts";
import { pluck } from "./pluck.ts";
import { to_set } from "./to_set.ts";
import { when } from "./when.ts";

export const std = new Map<string, unknown>([
  ["add", add],
  ["coalesce", coalesce],
  ["eq", eq],
  ["filter", filter],
  ["flat", flat],
  ["format", format],
  ["from_entries", from_entries],
  ["has", has],
  ["id", id],
  ["int", int],
  ["join", join],
  ["json", json],
  ["map", map],
  ["not", not],
  ["one", one],
  ["pack", pack],
  ["pluck", pluck],
  ["to_set", to_set],
  ["when", when],
]);
