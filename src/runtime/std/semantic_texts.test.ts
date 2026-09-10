import { assertEquals, assertThrows } from "@std/assert";
import {
  semantic_no_whitespace_texts,
  semantic_texts,
} from "./semantic_texts.ts";

Deno.test("std.semantic_texts omits comments", () => {
  assertEquals(
    semantic_texts([
      { kind: "word", text: "a" },
      { kind: "comment", text: "#x" },
      { kind: "whitespace", text: " " },
      { kind: "punctuation", text: "+" },
    ]),
    ["a", " ", "+"],
  );
});

Deno.test("std.semantic_no_whitespace_texts keeps word and punctuation", () => {
  assertEquals(
    semantic_no_whitespace_texts([
      { kind: "word", text: "a" },
      { kind: "whitespace", text: " " },
      { kind: "comment", text: "#x" },
      { kind: "punctuation", text: "+" },
      { kind: "newline", text: "\n" },
    ]),
    ["a", "+"],
  );
});

Deno.test("std.semantic_texts rejects non-arrays", () => {
  assertThrows(() => semantic_texts({} as never), TypeError);
});
