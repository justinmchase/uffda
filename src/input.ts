import { Path } from "./path.ts";

export class Input {
  public static readonly Default = () =>
    new Input(
      [],
      Path.Default(),
    );

  public static getIterator(value: string) {
    return value[Symbol.iterator]();
  }

  private _next: Input | undefined = undefined;
  private _done: boolean | undefined = undefined;
  private _items: Iterator<unknown>;

  constructor(
    public readonly items: Iterable<unknown> | Iterator<unknown>,
    public readonly path: Path = Path.Default(),
    public readonly index = 0,
    public readonly value?: unknown,
  ) {
    if ((items as Iterable<unknown>)[Symbol.iterator] !== undefined) {
      this._items = (items as Iterable<unknown>)[Symbol.iterator]();
    } else {
      this._items = items as Iterator<unknown>;
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
