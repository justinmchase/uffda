import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  andThen,
  attempt,
  eachInOrder,
  ensure,
  mapInOrder,
  repeatUntil,
} from "./awaitable.ts";

const thenable = <T>(value: T) => ({
  then(resolve: (value: T) => void) {
    resolve(value);
  },
});

Deno.test("runtime/awaitable", async (t) => {
  await t.step("AWAITABLE00 - andThen applies immediately to a value", () => {
    assertEquals(andThen(2, (n) => n + 1), 3);
  });

  await t.step(
    "AWAITABLE01 - andThen continues a promise and a foreign thenable",
    async () => {
      const fromPromise = andThen(Promise.resolve(2), (n) => n + 1);
      assert(fromPromise instanceof Promise);
      assertEquals(await fromPromise, 3);
      const fromThenable = andThen(
        thenable(2) as unknown as Promise<number>,
        (n) => n + 1,
      );
      assert(fromThenable instanceof Promise);
      assertEquals(await fromThenable, 3);
    },
  );

  await t.step("AWAITABLE02 - andThen propagates a rejection", async () => {
    let called = false;
    await assertRejects(
      async () =>
        await andThen(Promise.reject(new Error("boom")), () => {
          called = true;
        }),
      Error,
      "boom",
    );
    assertEquals(called, false);
  });

  await t.step(
    "AWAITABLE03 - attempt routes a sync throw and a rejection to onError",
    async () => {
      const onError = (err: unknown) => `caught ${(err as Error).message}`;
      assertEquals(
        attempt(
          () => {
            throw new Error("sync");
          },
          () => "value",
          onError,
        ),
        "caught sync",
      );
      assertEquals(
        await attempt(
          () => Promise.reject(new Error("async")),
          () => "value",
          onError,
        ),
        "caught async",
      );
      assertEquals(attempt(() => 1, (n) => `value ${n}`, onError), "value 1");
    },
  );

  await t.step(
    "AWAITABLE04 - ensure cleans up after a value, a throw and a rejection",
    async () => {
      let cleaned = 0;
      const cleanup = () => {
        cleaned++;
      };
      assertEquals(ensure(() => 1, cleanup), 1);
      assertThrows(() =>
        ensure(() => {
          throw new Error("sync");
        }, cleanup)
      );
      await assertRejects(async () =>
        await ensure(() => Promise.reject(new Error("async")), cleanup)
      );
      assertEquals(cleaned, 3);
    },
  );

  await t.step(
    "AWAITABLE05 - eachInOrder is synchronous for immediate steps and stops when settled",
    () => {
      const seen: number[] = [];
      const result = eachInOrder(
        5,
        (i) => i,
        (_, n) => {
          seen.push(n);
          return n === 2 ? "stopped" : undefined;
        },
        () => "done",
      );
      assertEquals(result, "stopped");
      assertEquals(seen, [0, 1, 2]);
      assertEquals(
        eachInOrder(2, (i) => i, () => undefined, () => "done"),
        "done",
      );
    },
  );

  await t.step(
    "AWAITABLE06 - eachInOrder runs steps in order across an async step",
    async () => {
      const order: string[] = [];
      const result = eachInOrder(
        3,
        (i) => {
          order.push(`step ${i}`);
          return i === 1 ? Promise.resolve(i) : i;
        },
        (i) => {
          order.push(`settle ${i}`);
          return undefined;
        },
        () => "done",
      );
      assert(result instanceof Promise);
      assertEquals(await result, "done");
      assertEquals(order, [
        "step 0",
        "settle 0",
        "step 1",
        "settle 1",
        "step 2",
        "settle 2",
      ]);
    },
  );

  await t.step(
    "AWAITABLE07 - repeatUntil repeats until settled, sync or async",
    async () => {
      let n = 0;
      assertEquals(repeatUntil(() => ++n, (v) => v >= 3 ? v : undefined), 3);
      let m = 0;
      const result = repeatUntil(
        () => Promise.resolve(++m),
        (v) => v >= 3 ? v : undefined,
      );
      assert(result instanceof Promise);
      assertEquals(await result, 3);
    },
  );

  await t.step(
    "AWAITABLE08 - mapInOrder maps in order, sync or async",
    async () => {
      assertEquals(mapInOrder([1, 2, 3], (n) => n * 2), [2, 4, 6]);
      const result = mapInOrder(
        [1, 2, 3],
        (n) => n === 2 ? Promise.resolve(n * 2) : n * 2,
      );
      assert(result instanceof Promise);
      assertEquals(await result, [2, 4, 6]);
    },
  );
});
