import { assert, assertStrictEquals } from "@std/assert";
import { assertEquals } from "@std/assert/equals";
import { Input, InputNormalizationMode } from "./input.ts";
import { Path } from "./path.ts";

Deno.test({
  name: "runtime/input",
  fn: async (t) => {
    await t.step({
      name: "INPUT00",
      fn: async () => {
        const input = Input.Default();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(0),
          index: 0,
          value: undefined,
          done: true,
        });
      },
    });
    await t.step({
      name: "INPUT01",
      fn: async () => {
        const input = Input.Iterable([1, 2, 3]);
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(0),
          index: 0,
          value: undefined,
          done: false,
        });
      },
    });
    await t.step({
      name: "INPUT02",
      fn: async () => {
        const input = await Input.Iterable(["x", "y", "z"])
          .next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(1),
          index: 1,
          value: "x",
          done: false,
        });
      },
    });
    await t.step({
      name: "INPUT03",
      fn: async () => {
        const input = await (await Input.Iterable(["x", "y", "z"])
          .next()).next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(2),
          index: 2,
          value: "y",
          done: false,
        });
      },
    });
    await t.step({
      name: "INPUT04",
      fn: async () => {
        const input = await (await (await Input.Iterable(["x", "y", "z"])
          .next()).next()).next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(3),
          index: 3,
          value: "z",
          done: true,
        });
      },
    });

    await t.step({
      name: "INPUT05",
      fn: async () => {
        const input = await (await (await (await Input.Iterable(["x", "y", "z"])
          .next()).next()).next()).next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(3),
          index: 3,
          value: "z",
          done: true,
        });
      },
    });

    await t.step({
      name: "INPUT06",
      fn: async () => {
        const input = await Input.From(null).next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(1),
          index: 1,
          value: null,
          done: true,
        });
      },
    });

    await t.step({
      name: "INPUT07",
      fn: async () => {
        const i1 = await Input.Iterable("abc").next();
        const i2 = await i1.next();
        const input = await i2.next();
        const { path, index, value } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done }, {
          path: Path.From(3),
          index: 3,
          value: "c",
          done: true,
        });
      },
    });

    await t.step({
      name: "INPUT08",
      fn: async () => {
        const input = await Input.From("abc")
          .next();
        const { path, index, value, kind } = input;
        const done = await input.done();
        assertEquals({ path, index, value, done, kind }, {
          path: Path.From(1),
          index: 1,
          value: "abc",
          done: true,
          kind: InputNormalizationMode.Scalar,
        });
      },
    });

    await t.step({
      name: "INPUT09",
      fn: () => {
        let message = "";
        try {
          Input.From(7, { kind: InputNormalizationMode.Iterable });
        } catch (error) {
          message = (error as Error).message;
        }
        assertEquals(
          message,
          "Iterable normalization mode requires an iterable or iterator input value",
        );
      },
    });

    await t.step({
      name: "INPUT10 isEof does not advance the stream",
      fn: async () => {
        const start = Input.Iterable(["x"]);
        assertEquals(start.isEof, false);
        assertEquals(await start.done(), false);
        const atItem = await start.next();
        assertEquals(atItem.isEof, false);
        assertEquals(atItem.value, "x");
        const eof = await atItem.next();
        assertEquals(eof.isEof, true);
        assertEquals(await eof.done(), true);
        assertEquals(eof.value, "x");
      },
    });
  },
});

Deno.test("input.open carries to every later position", async () => {
  const closed = Input.From("ab", { kind: InputNormalizationMode.Iterable });
  assertEquals(closed.open, false);
  const open = Input.From("ab", {
    kind: InputNormalizationMode.Iterable,
    open: true,
  });
  const end = await (await open.next()).next();
  assertEquals([open.open, end.open, await end.done()], [true, true, true]);
});

Deno.test("input advances synchronously over immediate items", () => {
  const input = Input.From("ab", { kind: InputNormalizationMode.Iterable });
  const first = input.step();
  assert(first instanceof Input);
  assertEquals(first.value, "a");
  assertEquals(input.done(), false);
  const second = first.next() as Input;
  assertEquals(second.value, "b");
  assertEquals(second.step(), undefined);
  assertEquals(second.done(), true);
});

Deno.test("input advances through promises over async items", async () => {
  const input = Input.From(
    (async function* () {
      yield "a";
    })(),
    { kind: InputNormalizationMode.Iterable },
  );
  const first = input.step();
  assert(first instanceof Promise);
  assertEquals((await first)?.value, "a");
  assertEquals(input.done(), false);
  const eof = (await input.next()).step();
  assert(eof instanceof Promise);
  assertEquals(await eof, undefined);
});

Deno.test("input step reuses a known next position without re-pulling", async () => {
  const input = Input.From("ab", { kind: InputNormalizationMode.Iterable });
  const first = await input.step();
  assertStrictEquals(input.step(), first);
  const second = await first!.step();
  const end = await second!.step();
  assertEquals(end, undefined);
  assertEquals(second!.step(), undefined);
});
