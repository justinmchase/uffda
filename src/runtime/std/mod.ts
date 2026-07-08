import { add } from "./add.ts";
import { coalesce } from "./coalesce.ts";
import { filter } from "./filter.ts";
import { format } from "./format.ts";
import { id } from "./id.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { map } from "./map.ts";
import { pack } from "./pack.ts";

export const std = new Map<string, unknown>([
  ["add", add],
  ["coalesce", coalesce],
  ["filter", filter],
  ["format", format],
  ["id", id],
  ["join", join],
  ["json", json],
  ["map", map],
  ["pack", pack],
]);
