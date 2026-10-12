import { Type, type } from "@justinmchase/type";
import { unwrap } from "../wrapped.ts";

function quoted(text: string): string {
  let result = '"';
  for (const char of text) {
    switch (char) {
      case "\\":
      case '"':
      case "{":
        result += `\\${char}`;
        break;
      case "\n":
        result += "\\n";
        break;
      case "\r":
        result += "\\r";
        break;
      case "\t":
        result += "\\t";
        break;
      default:
        if (
          char.charCodeAt(0) < 32 ||
          (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159)
        ) {
          throw new TypeError(
            "Value contains an unsupported Uffda string character",
          );
        }
        result += char;
    }
  }
  return `${result}"`;
}

type Frame = { value: unknown } | { text: string } | { leave: object };

export function uffdaOutput(value: unknown): string | undefined {
  const raw = unwrap(value);
  const [rootType, root] = type(raw);
  if (rootType === Type.Undefined) return undefined;
  if (rootType === Type.String) return `${root}\n`;
  const frames: Frame[] = [{ value: raw }];
  const active = new Set<object>();
  const output: string[] = [];
  while (frames.length) {
    const frame = frames.pop()!;
    if ("text" in frame) {
      output.push(frame.text);
      continue;
    }
    if ("leave" in frame) {
      active.delete(frame.leave);
      continue;
    }
    const [t, v] = type(frame.value);
    switch (t) {
      case Type.Undefined:
        output.push("undefined");
        break;
      case Type.Null:
        output.push("null");
        break;
      case Type.Boolean:
        output.push(v ? "true" : "false");
        break;
      case Type.String:
        output.push(quoted(v));
        break;
      case Type.Number: {
        const magnitude = Math.abs(v).toString();
        if (
          !Number.isSafeInteger(v) ||
          Object.is(v, -0) || magnitude.includes("e")
        ) {
          throw new TypeError(
            "Number has no lossless Uffda literal representation",
          );
        }
        output.push(v < 0 ? `(sub 0 ${magnitude})` : magnitude);
        break;
      }
      case Type.Array:
      case Type.Object: {
        if (
          t === Type.Object && Object.getPrototypeOf(v) !== Object.prototype &&
          Object.getPrototypeOf(v) !== null
        ) {
          throw new TypeError("Object has no Uffda data representation");
        }
        if (Object.getOwnPropertySymbols(v).length) {
          throw new TypeError(
            "Symbol properties have no Uffda data representation",
          );
        }
        if (active.has(v)) {
          throw new TypeError("Cannot display a circular value");
        }
        active.add(v);
        frames.push({ leave: v });
        if (t === Type.Array) {
          output.push("[");
          frames.push({ text: "]" });
          for (let i = v.length - 1; i >= 0; i--) {
            frames.push({ value: v[i] });
            if (i !== 0) frames.push({ text: " " });
          }
        } else {
          output.push("{");
          frames.push({ text: "}" });
          const entries = Object.entries(v);
          for (let i = entries.length - 1; i >= 0; i--) {
            const [key, item] = entries[i];
            frames.push({ value: item });
            frames.push({ text: `[${quoted(key)}]: ` });
            if (i !== 0) frames.push({ text: ", " });
          }
        }
        break;
      }
      default:
        throw new TypeError(
          `Value of type ${t} has no Uffda data representation`,
        );
    }
  }
  return `${output.join("")}\n`;
}
