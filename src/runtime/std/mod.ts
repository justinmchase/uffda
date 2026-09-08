import { add } from "./add.ts";
import { coalesce } from "./coalesce.ts";
import { filter } from "./filter.ts";
import { flat } from "./flat.ts";
import { format } from "./format.ts";
import { id } from "./id.ts";
import { int } from "./int.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { map } from "./map.ts";
import { normalizeModule } from "./normalize_module.ts";
import { one } from "./one.ts";
import { pack } from "./pack.ts";

export const std = new Map<string, unknown>([
  ["add", add],
  ["coalesce", coalesce],
  ["filter", filter],
  ["flat", flat],
  ["format", format],
  ["id", id],
  ["int", int],
  ["join", join],
  ["json", json],
  ["map", map],
  ["normalizeModule", normalizeModule],
  ["one", one],
  ["pack", pack],
]);
