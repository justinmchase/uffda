import type { StackFrame } from "./frame.ts";

/**
 * An immutable, persistent stack of runtime frames.
 *
 * Every rule invocation derives a new scope with one more frame, and every
 * match retains the scope it ended in, so frames are shared structurally:
 * `push` is O(1) and each stack references its parent instead of copying it.
 */
export class CallStack {
  public static readonly Empty: CallStack = new CallStack(undefined, undefined);

  private constructor(
    public readonly top: StackFrame | undefined,
    /** The stack below `top`; `undefined` only for {@link CallStack.Empty}. */
    public readonly parent: CallStack | undefined,
    public readonly depth: number = 0,
  ) {}

  public push(frame: StackFrame): CallStack {
    return new CallStack(frame, this, this.depth + 1);
  }

  /** Frames from the bottom of the stack (outermost) to the top (innermost). */
  public frames(): StackFrame[] {
    if (this.top === undefined) return [];
    const frames = new Array<StackFrame>(this.depth);
    frames[this.depth - 1] = this.top;
    for (let s = this.parent; s?.top !== undefined; s = s.parent) {
      frames[s.depth - 1] = s.top;
    }
    return frames;
  }
}
