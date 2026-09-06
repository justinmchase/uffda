import { Path } from "./path.ts";

export enum InputNormalizationMode {
  Scalar = "scalar",
  Iterable = "iterable",
}

export type InputMode = {
  kind: InputNormalizationMode;
};

export function isInput(value: unknown): value is Input {
  if (value == null) return false;
  if (typeof value !== "object") return false;

  const input = value as Input;
  return Object.values(InputNormalizationMode).includes(input.kind);
}

function assertNormalizationMode(
  mode: InputNormalizationMode | string,
): InputNormalizationMode {
  if (
    mode !== InputNormalizationMode.Scalar &&
    mode !== InputNormalizationMode.Iterable
  ) {
    throw new TypeError(
      `Unknown input normalization mode: ${mode}`,
    );
  }
  return mode;
}

export type SourceProvenance = {
  normalizationMap?: readonly number[];
  /**
   * When the stream items are tokens (or other projections of source), maps
   * each item index to character spans in normalized and original source.
   */
  itemSpans?: readonly import("./span.ts").ItemSourceSpan[];
};

type InputFromOptions = {
  kind?: InputNormalizationMode;
  provenance?: SourceProvenance;
};

export function sourceProvenanceFrom(
  value: unknown,
): SourceProvenance | undefined {
  if (value == null || typeof value !== "object") {
    return undefined;
  }
  const record = value as {
    documentId?: unknown;
    normalizationMap?: unknown;
  };
  if (typeof record.documentId !== "string") {
    return undefined;
  }
  if (!Array.isArray(record.normalizationMap)) {
    return undefined;
  }
  if (!record.normalizationMap.every((offset) => typeof offset === "number")) {
    return undefined;
  }
  return { normalizationMap: record.normalizationMap as number[] };
}

export class Input {
  public static readonly Default = (): Input =>
    Input.From([], { kind: InputNormalizationMode.Iterable });

  public static readonly From = (
    items: Iterable<unknown> | Iterator<unknown> | unknown,
    options?: InputFromOptions,
  ): Input =>
    new Input(
      items,
      Path.Default(),
      0,
      undefined,
      options?.kind ?? InputNormalizationMode.Scalar,
      false,
      options?.provenance,
    );

  public static readonly Scalar = (value: unknown): Input =>
    Input.From(value, { kind: InputNormalizationMode.Scalar });

  public static readonly Iterable = (
    value: Iterable<unknown> | Iterator<unknown>,
  ): Input => Input.From(value, { kind: InputNormalizationMode.Iterable });

  public static isIterable(value: unknown): value is Iterable<unknown> {
    return value != null &&
      typeof (value as Iterable<unknown>)[Symbol.iterator] === "function";
  }
  public static isIterator(value: unknown): value is Iterator<unknown> {
    return value != null &&
      typeof (value as Iterator<unknown>).next === "function";
  }

  private _next: Input | undefined = undefined;
  private _done: boolean | undefined = undefined;
  private _items: Iterator<unknown>;

  constructor(
    public readonly items: Iterable<unknown> | Iterator<unknown> | unknown,
    public readonly path: Path = Path.Default(),
    public readonly index = 0,
    public readonly value?: unknown,
    public readonly kind: InputNormalizationMode =
      InputNormalizationMode.Scalar,
    private readonly trustedIterator = false,
    public readonly provenance?: SourceProvenance,
  ) {
    if (trustedIterator) {
      if (!Input.isIterator(items)) {
        throw new TypeError(
          "Trusted iterator construction requires an iterator",
        );
      }
      this._items = items;
      return;
    }

    if (
      provenance === undefined &&
      kind === InputNormalizationMode.Iterable
    ) {
      this.provenance = sourceProvenanceFrom(items);
    }

    const mode = assertNormalizationMode(kind);
    if (mode === InputNormalizationMode.Scalar) {
      this._items = [items][Symbol.iterator]();
      return;
    }

    if (Input.isIterable(items)) {
      this._items = items[Symbol.iterator]();
      return;
    }

    if (Input.isIterator(items)) {
      this._items = items;
      return;
    }

    throw new TypeError(
      "Iterable normalization mode requires an iterable or iterator input value",
    );
  }

  public get done(): boolean {
    if (this._done === undefined) {
      this.next();
    }
    return this._done!;
  }

  /**
   * Whether this position is already known to be past the last item.
   * Unlike {@link done}, this does not advance the stream.
   */
  public get isEof(): boolean {
    return this._done === true;
  }

  public next(): Input {
    if (!this._next) {
      const { value, done } = this._items.next();
      this._done = done;
      if (done) return this;

      const i = this.index + 1;
      this._next = new Input(
        this._items,
        this.path.set(i),
        i,
        value,
        this.kind,
        true,
        this.provenance,
      );
    }
    return this._next;
  }
}
