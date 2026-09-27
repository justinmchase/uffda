import { assertEquals, assertStrictEquals } from "@std/assert";
import { CallStack } from "./call_stack.ts";
import { StackFrameKind } from "./stackFrameKind.ts";
import { PatternKind } from "../patterns/mod.ts";
import type { StackFrame } from "./frame.ts";

const frame = (): StackFrame => ({
  kind: StackFrameKind.Pipeline,
  pipeline: { kind: PatternKind.Ok },
});

Deno.test("runtime.stack.call_stack", async (t) => {
  await t.step("CALL_STACK_EMPTY has no frames", () => {
    assertEquals(CallStack.Empty.depth, 0);
    assertStrictEquals(CallStack.Empty.top, undefined);
    assertStrictEquals(CallStack.Empty.parent, undefined);
    assertEquals(CallStack.Empty.frames(), []);
  });

  await t.step("CALL_STACK_PUSH adds a top frame over the parent", () => {
    const a = frame();
    const one = CallStack.Empty.push(a);
    assertEquals(one.depth, 1);
    assertStrictEquals(one.top, a);
    assertStrictEquals(one.parent, CallStack.Empty);
  });

  await t.step("CALL_STACK_SHARED pushes share, not copy, lower frames", () => {
    const base = CallStack.Empty.push(frame()).push(frame());
    const left = base.push(frame());
    const right = base.push(frame());
    assertStrictEquals(left.parent, base);
    assertStrictEquals(right.parent, base);
    assertEquals(base.depth, 2);
  });

  await t.step("CALL_STACK_FRAMES lists frames bottom to top", () => {
    const a = frame();
    const b = frame();
    const c = frame();
    const stack = CallStack.Empty.push(a).push(b).push(c);
    const frames = stack.frames();
    assertEquals(frames.length, 3);
    assertStrictEquals(frames[0], a);
    assertStrictEquals(frames[1], b);
    assertStrictEquals(frames[2], c);
  });

  await t.step(
    "CALL_STACK_IMMUTABLE push leaves the original unchanged",
    () => {
      const base = CallStack.Empty.push(frame());
      base.push(frame());
      assertEquals(base.depth, 1);
      assertEquals(base.frames().length, 1);
    },
  );
});
