import { defineMetadata } from "../value_metadata.ts";

export function format(value: string, ...args: unknown[]) {
  return value.replace(
    /{(\d+)}/g,
    (substring: string, ...matches: string[]) =>
      args[parseInt(matches[0])]?.toString() ?? substring,
  );
}

defineMetadata(format, {
  description:
    "Replaces {0}, {1}, … in a string with the corresponding arguments.",
  parameters: [{ name: "value" }, { name: "args", rest: true }],
});
