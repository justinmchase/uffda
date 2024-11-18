import { assertEquals } from "@std/assert/equals";
import { Input } from "./input.ts";
import { Path } from "./path.ts";

Deno.test({
  name: "runtime/input",
  fn: async (t) => {
    await t.step({
      name: "INPUT00",
      fn: () => {
        const { path, index, value, done } = Input.Default();
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
      fn: () => {
        const { path, index, value, done } = Input.From([1, 2, 3]);
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
      fn: () => {
        const { path, index, value, done } = Input.From(["x", "y", "z"]).next();
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
      fn: () => {
        const { path, index, value, done } = Input.From(["x", "y", "z"]).next()
          .next();
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
      fn: () => {
        const { path, index, value, done } = Input.From(["x", "y", "z"]).next()
          .next().next();
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
      fn: () => {
        const { path, index, value, done } = Input.From(["x", "y", "z"]).next()
          .next().next().next();
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
      fn: () => {
        const { path, index, value, done } = Input.From(null).next();
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
      fn: () => {
        const { path, index, value, done } = Input.From("abc").next().next()
          .next();
        assertEquals({ path, index, value, done }, {
          path: Path.From(3),
          index: 3,
          value: "c",
          done: true,
        });
      },
    });
  },
});
