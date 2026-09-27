import { Type, type } from "@justinmchase/type";

/**
 * Well-known symbol under which a runtime value (for example a global
 * function) carries descriptive metadata for tooling (see
 * `.agents/specifications/runtime/value-metadata.spec.md`). Registered via
 * `Symbol.for`, so any module — or a host embedding the runtime with its own
 * globals — reaches the same key without importing this one.
 */
export const METADATA: unique symbol = Symbol.for("uffda.metadata") as never;

export type FunctionParameterMetadata = {
  name: string;
  /** The parameter may be omitted. */
  optional?: boolean;
  /** The parameter collects every remaining argument. */
  rest?: boolean;
};

export type FunctionMetadata = {
  /** One-line summary of what the function returns or does. */
  description: string;
  parameters: FunctionParameterMetadata[];
};

/**
 * Attaches `metadata` to `fn` under `METADATA` as a frozen, non-enumerable,
 * read-only property. Purely descriptive: the function's behavior is
 * unchanged. Returns `fn`.
 */
export function defineMetadata<T extends object>(
  fn: T,
  metadata: FunctionMetadata,
): T {
  Object.defineProperty(fn, METADATA, {
    value: Object.freeze({
      description: metadata.description,
      parameters: Object.freeze(
        metadata.parameters.map((p) => Object.freeze({ ...p })),
      ),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return fn;
}

function isString(value: unknown): value is string {
  return type(value)[0] === Type.String;
}

function toParameter(value: unknown): FunctionParameterMetadata | undefined {
  const [t, v] = type(value);
  if (t !== Type.Object) return undefined;
  const { name, optional, rest } = v as Record<string, unknown>;
  if (!isString(name)) return undefined;
  return {
    name,
    ...(optional === true ? { optional } : {}),
    ...(rest === true ? { rest } : {}),
  };
}

/**
 * The function metadata `value` carries under `METADATA`, validated; a
 * missing or malformed entry yields `undefined` rather than a trusted shape.
 */
export function metadataOf(value: unknown): FunctionMetadata | undefined {
  const [t] = type(value);
  if (t !== Type.Function) return undefined;
  const raw = (value as { [METADATA]?: unknown })[METADATA];
  const [rt, rv] = type(raw);
  if (rt !== Type.Object) return undefined;
  const { description, parameters } = rv as Record<string, unknown>;
  if (!isString(description)) return undefined;
  const [pt, pv] = type(parameters);
  if (pt !== Type.Array) return undefined;
  const parsed = (pv as unknown[]).map(toParameter);
  if (parsed.some((p) => p === undefined)) return undefined;
  return {
    description,
    parameters: parsed as FunctionParameterMetadata[],
  };
}

/** `(name a b? ...rest)` — how an invocation of `name` is written. */
export function formatSignature(
  name: string,
  metadata: FunctionMetadata,
): string {
  const parameters = metadata.parameters.map((p) =>
    p.rest ? `...${p.name}` : p.optional ? `${p.name}?` : p.name
  );
  return `(${[name, ...parameters].join(" ")})`;
}
