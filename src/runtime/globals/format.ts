import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

export function format(template: unknown, ...args: unknown[]) {
  return (rawOf(template) as string).replace(
    /{(\d+)}/g,
    (substring: string, ...matches: string[]) =>
      rawOf(args[parseInt(matches[0])])?.toString() ?? substring,
  );
}

defineMetadata(format, {
  description:
    "Replaces {0}, {1}, … in a string with the corresponding arguments.",
  parameters: [{ name: "value" }, { name: "args", rest: true }],
});
