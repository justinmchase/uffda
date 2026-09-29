import { defineMetadata } from "../value_metadata.ts";
import {
  concat,
  isWrapped,
  rawOf,
  sliceString,
  unwrap,
  type Wrapped,
} from "../../wrapped.ts";

const PLACEHOLDER = /{(\d+)}/g;

/**
 * Replaces `{0}`, `{1}`, … with the corresponding arguments, keeping each
 * character's provenance: template text keeps its own, a string argument keeps
 * its own, and a converted argument takes the template's origin.
 */
export function format(template: unknown, ...args: unknown[]) {
  if (!isWrapped(template)) {
    return (template as string).replace(
      PLACEHOLDER,
      (substring: string, index: string) =>
        rawOf(args[parseInt(index)])?.toString() ?? substring,
    );
  }
  const source = template as Wrapped<string>;
  const parts: unknown[] = [];
  let last = 0;
  for (const m of source.raw.matchAll(PLACEHOLDER)) {
    parts.push(sliceString(source, last, m.index));
    last = m.index + m[0].length;
    const arg = args[parseInt(m[1])];
    const raw = rawOf(arg);
    if (typeof raw === "string") parts.push(arg);
    else if (raw != null) parts.push(String(unwrap(arg)));
    else parts.push(sliceString(source, m.index, last));
  }
  parts.push(sliceString(source, last));
  return concat(parts, source.origin);
}

defineMetadata(format, {
  description:
    "Replaces {0}, {1}, … in a string with the corresponding arguments.",
  parameters: [{ name: "value" }, { name: "args", rest: true }],
});
