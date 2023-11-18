import { Path } from "./path.ts";

export class Input {
  public static readonly Default = () =>
    new Input(
      Path.Default(),
      [][Symbol.iterator](),
    );

  public static readonly From = (s: Input | Iterable<unknown>) =>
    s instanceof Input ? s : new Input(
      Path.Default(),
      s[Symbol.iterator](),
    );

  private _next: Input | undefined = undefined;
  private _done: boolean | undefined = undefined;

  constructor(
    public readonly path: Path,
    public readonly items: Iterator<unknown>,
    public readonly index = 0,
    public readonly value?: unknown,
  ) {
  }

  public get done(): boolean {
    if (this._done === undefined) {
      this.next();
    }
    return this._done!;
  }

  public next(): Input {
    if (!this._next) {
      const { value, done } = this.items.next();
      this._done = done;
      if (done) return this;

      const i = this.index + 1;
      this._next = new Input(
        this.path.moveTo(i),
        this.items,
        i,
        value,
      );
    }
    return this._next;
  }
}
