import { assertEquals } from "../../deps/std.ts";
import { snippet } from "./snippet.ts";

const testCases = [
  { index: 0, lines: ["abc"], text: "  abc\n--^", column: 0, line: 0 },
  { index: 1, lines: ["abc"], text: "  abc\n---^", column: 1, line: 0 },
  { index: 2, lines: ["abc"], text: "  abc\n----^", column: 2, line: 0 },
  { index: 3, lines: ["abc"], text: "  abc\n-----^", column: 3, line: 0 },
  {
    index: 4,
    lines: ["abc", "xyz"],
    text: "  abc\n  xyz\n--^",
    column: 0,
    line: 1,
  },
  {
    index: 5,
    lines: ["abc", "xyz"],
    text: "  abc\n  xyz\n---^",
    column: 1,
    line: 1,
  },
  {
    index: 6,
    lines: ["abc", "xyz"],
    text: "  abc\n  xyz\n----^",
    column: 2,
    line: 1,
  },
  {
    index: 7,
    lines: ["abc", "xyz"],
    text: "  abc\n  xyz\n-----^",
    column: 3,
    line: 1,
  },
  {
    index: 8,
    lines: ["abc", "xyz", ""],
    text: "  abc\n  xyz\n  \n--^",
    column: 0,
    line: 2,
  },
  {
    index: 9,
    lines: ["abc", "xyz", ""],
    text: "  abc\n  xyz\n  \n--^",
    column: 0,
    line: 2,
  },
];

let i = 0;
for (const { lines, text, index, column, line } of testCases) {
  const name = `SNIPPET${(i / 100).toFixed(2).replace(/^0[.]/, "")}`;
  i++;
  Deno.test({
    name,
    fn: () => {
      const input = "abc\nxyz\n";
      const actual = snippet(index, input);
      assertEquals(actual, {
        index,
        column,
        line,
        lines: ["abc", "xyz", ""],
        snippetLines: lines,
        snippetText: text,
      });
    },
  });
}
