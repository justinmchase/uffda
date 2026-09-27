import { Path } from "./path.ts";
import { andThen, type Awaitable } from "./runtime/awaitable.ts";

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
  /** Whether the input may continue past its last item (see `Input.open`). */
  open?: boolean;
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
    items:
      | Iterable<unknown>
      | Iterator<unknown>
      | AsyncIterable<unknown>
      | AsyncIterator<unknown>
      | unknown,
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
      false,
      options?.open ?? false,
    );

  public static readonly Scalar = (value: unknown): Input =>
    Input.From(value, { kind: InputNormalizationMode.Scalar });

  public static readonly Iterable = (
    value:
      | Iterable<unknown>
      | Iterator<unknown>
      | AsyncIterable<unknown>
      | AsyncIterator<unknown>,
  ): Input => Input.From(value, { kind: InputNormalizationMode.Iterable });

  public static isIterable(value: unknown): value is Iterable<unknown> {
    return value != null &&
      typeof (value as Iterable<unknown>)[Symbol.iterator] === "function";
  }
  public static isIterator(value: unknown): value is Iterator<unknown> {
    return value != null &&
      typeof (value as Iterator<unknown>).next === "function";
  }
  public static isAsyncIterable(
    value: unknown,
  ): value is AsyncIterable<unknown> {
    return value != null &&
      typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
        "function";
  }

  private _next: Input | undefined = undefined;
  private _done: boolean | undefined = undefined;
  private _items: Iterator<unknown> | AsyncIterator<unknown>;
  private readonly isAsync: boolean;

  constructor(
    public readonly items:
      | Iterable<unknown>
      | Iterator<unknown>
      | AsyncIterable<unknown>
      | AsyncIterator<unknown>
      | unknown,
    public readonly path: Path = Path.Default(),
    public readonly index = 0,
    public readonly value?: unknown,
    public readonly kind: InputNormalizationMode =
      InputNormalizationMode.Scalar,
    private readonly trustedIterator = false,
    public readonly provenance?: SourceProvenance,
    trustedIsAsync = false,
    /**
     * Whether the input may continue past its last item: it is a prefix of
     * a longer input still being written (for example the text before an
     * editor's cursor). Exhausting an open input is not the end of the
     * input, so patterns that stop at the end (repetition) still attempt
     * their next element there.
     */
    public readonly open = false,
  ) {
    if (trustedIterator) {
      if (!Input.isIterator(items)) {
        throw new TypeError(
          "Trusted iterator construction requires an iterator",
        );
      }
      this._items = items;
      this.isAsync = trustedIsAsync;
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
      this.isAsync = false;
      return;
    }

    if (Input.isAsyncIterable(items)) {
      this._items = items[Symbol.asyncIterator]();
      this.isAsync = true;
      return;
    }

    if (Input.isIterable(items)) {
      this._items = items[Symbol.iterator]();
      this.isAsync = false;
      return;
    }

    if (Input.isIterator(items)) {
      this._items = items;
      this.isAsync = false;
      return;
    }

    throw new TypeError(
      "Iterable normalization mode requires an iterable or iterator input value",
    );
  }

  /**
   * Whether the stream has been fully consumed. Advances the stream (pulling
   * one item, possibly asynchronously) if that isn't already known.
   */
  public done(): Awaitable<boolean> {
    if (this._done !== undefined) {
      return this._done;
    }
    return andThen(this.next(), () => this._done!);
  }

  /**
   * The following input position, or `undefined` when the stream is done.
   * Resolves immediately for synchronous streams.
   */
  public step(): Awaitable<Input | undefined> {
    if (this._next) return this._next;
    if (this._done) return undefined;
    return andThen(this.next(), (next) => this._done ? undefined : next);
  }

  /**
   * Whether this position is already known to be past the last item.
   * Unlike {@link done}, this does not advance the stream.
   */
  public get isEof(): boolean {
    return this._done === true;
  }

  public next(): Awaitable<Input> {
    if (this._next) {
      return this._next;
    }
    if (this._done) {
      return this;
    }
    return andThen(this._items.next(), (result) => this.advance(result));
  }

  private advance(result: IteratorResult<unknown>): Input {
    this._done = result.done ?? false;
    if (this._done) {
      return this;
    }
    const i = this.index + 1;
    this._next = new Input(
      this._items,
      this.path.set(i),
      i,
      result.value,
      this.kind,
      true,
      this.provenance,
      this.isAsync,
      this.open,
    );
    return this._next;
  }
}
