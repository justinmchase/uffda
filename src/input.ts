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

type InputFromOptions = {
  kind?: InputNormalizationMode;
};

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
      );
    }
    return this._next;
  }
}
