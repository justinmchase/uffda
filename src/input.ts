import { Path } from "./path.ts";

export class Input {
  public static readonly Default = (): Input => Input.From([]);
  public static readonly From = (
    items: Iterable<unknown> | Iterator<unknown> | unknown,
  ): Input => new Input(items);

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
  ) {
    if (Input.isIterable(items)) {
      this._items = items[Symbol.iterator]();
    } else if (Input.isIterator(items)) {
      this._items = items;
    } else {
      // If you give us something non-iterable then we will wrap it in an array
      this._items = [items][Symbol.iterator]();
    }
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
      );
    }
    return this._next;
  }
}
