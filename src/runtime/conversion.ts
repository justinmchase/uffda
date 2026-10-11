import { Type, type } from "@justinmchase/type";
import { rawOf, unwrap } from "../wrapped.ts";

export function assertNotCallable(value: unknown): void {
  if (type(rawOf(value))[0] === Type.Function) {
    throw new TypeError("Cannot convert a callable to text or JSON");
  }
}

export function assertTextValue(value: unknown): void {
  const [t] = type(rawOf(value));
  switch (t) {
    case Type.String:
    case Type.Number:
    case Type.Boolean:
    case Type.Null:
    case Type.Undefined:
    case Type.BigInt:
    case Type.Symbol:
      return;
    case Type.Function:
      throw new TypeError("Cannot convert a callable to text or JSON");
    default:
      throw new TypeError(
        "Cannot implicitly convert a composite value to text",
      );
  }
}

export function stringText(value: unknown): string {
  assertTextValue(value);
  return String(rawOf(value));
}

export function jsonText(value: unknown, space?: number): string | undefined {
  const raw = unwrap(value);
  assertNotCallable(raw);
  const pending = [raw];
  const seen = new Set<unknown>();
  while (pending.length) {
    const item = pending.pop();
    assertNotCallable(item);
    const [t, v] = type(item);
    if (seen.has(v)) continue;
    seen.add(v);
    if (t === Type.Array) {
      for (const child of v) pending.push(child);
    } else if (t === Type.Object && type(v.toJSON)[0] !== Type.Function) {
      for (const child of Object.values(v)) pending.push(child);
    }
  }
  return JSON.stringify(raw, function (key, converted) {
    // JSON calls toJSON before the replacer; inspect both sides of that hook.
    assertNotCallable(this[key]);
    assertNotCallable(converted);
    return converted;
  }, space);
}
