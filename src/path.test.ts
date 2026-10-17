import { assertEquals } from "@std/assert";
import { Path } from "./path.ts";

Deno.test({
  name: "path push",
  fn: () => {
    const p0 = Path.Default();
    const p1 = p0.push(1);
    assertEquals(p0.segments, [0]);
    assertEquals(p1.segments, [0, 1]);
  },
});

Deno.test({
  name: "path pop",
  fn: () => {
    const p0 = new Path(0, 1);
    const p1 = p0.pop();
    assertEquals(p0.segments, [0, 1]);
    assertEquals(p1.segments, [0]);
  },
});

Deno.test({
  name: "path set",
  fn: () => {
    const p0 = new Path(0, 1);
    const p1 = p0.set(2);
    assertEquals(p0.segments, [0, 1]);
    assertEquals(p1.segments, [0, 2]);
  },
});

Deno.test({
  name: "path set on an empty path adds the segment",
  fn: () => {
    assertEquals(new Path().set(3).segments, [3]);
  },
});

Deno.test({
  name: "path set and push validate the new segment",
  fn: () => {
    const p0 = new Path(0);
    assertEquals(p0.push(1.5 as number).segments, [0, "1.5"]);
    assertEquals(p0.set(2.5 as number).segments, ["2.5"]);
  },
});

Deno.test({
  name: "path derived paths equal constructed paths",
  fn: () => {
    assertEquals(new Path(0, "a").push(1), new Path(0, "a", 1));
    assertEquals(new Path(0, 1).set(2), Path.From(0, 2));
    assertEquals(new Path(0, 1).pop(), Path.From(0));
  },
});
