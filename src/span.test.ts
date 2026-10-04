import { assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "./input.ts";
import {
  leafOffset,
  sourceOffsetAt,
  sourceSpanFrom,
  spanFrom,
} from "./span.ts";
import { Scope } from "./runtime/scope.ts";
import { Path } from "./path.ts";
import { Wrapped } from "./wrapped.ts";

/** Items separated by dropped trivia: "import" at 0..6, '"' at 7..8, "." at 8..9. */
function tokens(): Input {
  return Input.Iterable([
    new Wrapped("import", { start: 0, end: 6 }),
    new Wrapped('"', { start: 7, end: 8 }),
    new Wrapped(".", { start: 8, end: 9 }),
  ]);
}

Deno.test("span", async (t) => {
  await t.step("spanFrom takes the stream paths", async () => {
    const stream = Input.Iterable("ab");
    const next = await stream.next();
    assertEquals(spanFrom(Scope.From(stream), Scope.From(next)), {
      start: stream.path,
      end: next.path,
    });
  });

  await t.step("leafOffset is the last numeric segment", () => {
    assertEquals(leafOffset(Path.Default()), 0);
    assertEquals(leafOffset(Path.Default().set(3)), 3);
    assertEquals(leafOffset(Path.Default().set(3).push("key")), 3);
  });

  await t.step(
    "sourceSpanFrom spans the origins of the consumed items",
    async () => {
      const stream = tokens();
      const first = await stream.next();
      const second = await first.next();
      const third = await second.next();
      assertEquals(
        sourceSpanFrom(Scope.From(stream), Scope.From(first)),
        { start: 0, end: 6 },
      );
      assertEquals(
        sourceSpanFrom(Scope.From(first), Scope.From(third)),
        { start: 7, end: 9 },
      );
    },
  );

  await t.step(
    "a zero-width span is the start of the next item once read",
    async () => {
      const stream = tokens();
      const first = await stream.next();
      await first.next();
      const at = Scope.From(first);
      assertEquals(sourceSpanFrom(at, at), { start: 7, end: 7 });
    },
  );

  await t.step(
    "sourceOffsetAt is where a zero-width span there would be",
    async () => {
      const stream = tokens();
      assertEquals(sourceOffsetAt(stream), 0);
      const first = await stream.next();
      assertEquals(sourceOffsetAt(first), 6);
      await first.next();
      assertEquals(sourceOffsetAt(first), 7);
    },
  );

  await t.step(
    "a zero-width span is the end of the item before when the next is unread",
    async () => {
      const first = await tokens().next();
      const at = Scope.From(first);
      assertEquals(sourceSpanFrom(at, at), { start: 6, end: 6 });
    },
  );

  await t.step(
    "a zero-width span at the end is the end of the last item",
    async () => {
      const stream = Input.Iterable([
        new Wrapped("abc", { start: 8, end: 11 }),
      ]);
      const last = await stream.next();
      const eof = await last.next();
      assertEquals(eof.isEof, true);
      const at = Scope.From(eof);
      assertEquals(sourceSpanFrom(at, at), { start: 11, end: 11 });
    },
  );

  await t.step(
    "a zero-width span before anything is read is the stream's start",
    () => {
      const root = Scope.From(Input.Iterable("ab"));
      assertEquals(sourceSpanFrom(root, root), { start: 0, end: 0 });
      const derived = Scope.From(
        Input.From(new Wrapped(["a"], { start: 4, end: 9 }), {
          kind: InputNormalizationMode.Iterable,
        }),
      );
      assertEquals(sourceSpanFrom(derived, derived), { start: 4, end: 4 });
    },
  );

  await t.step("root input items are their offsets", async () => {
    const stream = Input.Iterable("ab");
    const first = await stream.next();
    const second = await first.next();
    assertEquals(
      sourceSpanFrom(Scope.From(stream), Scope.From(second)),
      { start: 0, end: 2 },
    );
  });

  await t.step(
    "a scalar root string's characters are their offsets",
    async () => {
      const value = await Input.Scalar("abc").next();
      assertEquals(value.value?.origin, { start: 0, end: 3 });
      const chars = Input.From(value.value, {
        kind: InputNormalizationMode.Iterable,
      });
      const first = await chars.next();
      const second = await first.next();
      assertEquals(
        sourceSpanFrom(Scope.From(first), Scope.From(second)),
        { start: 1, end: 2 },
      );
    },
  );
});
