import { assertEquals } from "@std/assert";
import { lt } from "./lt.ts";

Deno.test("runtime.lt is true only when left sorts strictly before right", () => {
  assertEquals(lt(1, 2), true);
  assertEquals(lt(2, 1), false);
  assertEquals(lt(2, 2), false);
});
