import {
  isWrapped,
  type Origin,
  rootOrigin,
  wrap,
  wrapItem,
  type Wrapped,
  wrapRoot,
} from "./wrapped.ts";
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

type InputFromOptions = {
  kind?: InputNormalizationMode;
  /** Origin of raw items; without it they are root positions (see {@link Input}). */
  origin?: Origin;
  /** Whether the input may continue past its last item (see `Input.open`). */
  open?: boolean;
};

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
      false,
      options?.open ?? false,
      options?.origin,
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
  private readonly source: Wrapped | undefined;

  constructor(
    public readonly items:
      | Iterable<unknown>
      | Iterator<unknown>
      | AsyncIterable<unknown>
      | AsyncIterator<unknown>
      | unknown,
    public readonly path: Path = Path.Default(),
    public readonly index = 0,
    /** The item this position holds; see {@link wrapItem}. */
    public readonly value?: Wrapped,
    public readonly kind: InputNormalizationMode =
      InputNormalizationMode.Scalar,
    private readonly trustedIterator = false,
    trustedIsAsync = false,
    /**
     * Whether the input may continue past its last item: it is a prefix of
     * a longer input still being written (for example the text before an
     * editor's cursor). Exhausting an open input is not the end of the
     * input, so patterns that stop at the end (repetition) still attempt
     * their next element there.
     */
    public readonly open = false,
    /**
     * Origin of raw items that are not characters of a wrapped string. When
     * absent, raw items are host input and their origin is their root
     * position.
     */
    private readonly origin?: Origin,
    source?: Wrapped,
  ) {
    if (isWrapped(items)) {
      source = items;
      items = items.raw;
    }
    this.source = source;
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

  /**
   * The following input position if it has already been read. Unlike
   * {@link step}, this does not advance the stream.
   */
  public get following(): Input | undefined {
    return this._next;
  }

  /** The source offset before the first item (see `sourceSpanFrom`). */
  public get base(): number {
    return (this.source?.origin ?? this.origin)?.start ?? 0;
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
      this.wrapItem(result.value),
      this.kind,
      true,
      this.isAsync,
      this.open,
      this.origin,
      this.source,
    );
    return this._next;
  }

  /**
   * The item following this position, wrapped. A scalar input's only item is
   * its whole value; see {@link origin} for raw items.
   */
  private wrapItem(item: unknown): Wrapped {
    const { source, index } = this;
    if (this.kind === InputNormalizationMode.Scalar) {
      return source ?? (this.origin ? wrap(item, this.origin) : wrapRoot(item));
    }
    if (source) return wrapItem(source, item, index);
    return wrap(item, this.origin ?? rootOrigin(index));
  }
}
