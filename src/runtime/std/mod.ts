import { add } from "./add.ts";
import { filter } from "./filter.ts";
import { format } from "./format.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { map } from "./map.ts";

export const std = new Map<string, unknown>([
  ["add", add],
  ["filter", filter],
  ["format", format],
  ["join", join],
  ["json", json],
  ["map", map],
]);
