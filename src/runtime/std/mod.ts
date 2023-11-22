import { filter } from "./filter.ts";
import { format } from "./format.ts";
import { join } from "./join.ts";
import { json } from "./json.ts";
import { map } from "./map.ts";

export const std = new Map<string, unknown>([
  ["filter", filter],
  ["format", format],
  ["join", join],
  ["json", json],
  ["map", map]
])
