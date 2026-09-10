import { assertEquals } from "@std/assert";
import {
  semantic_no_whitespace_texts,
  semantic_texts,
} from "../../runtime/std/semantic_texts.ts";

Deno.test("req:tokenizer-runtime-010 - std semantic texts omit comments and optional whitespace", () => {
  const tokens = [
    { kind: "word", text: "a" },
    { kind: "comment", text: "#x" },
    { kind: "whitespace", text: " " },
    { kind: "punctuation", text: "+" },
    { kind: "newline", text: "\n" },
  ];
  assertEquals(semantic_texts(tokens), ["a", " ", "+", "\n"]);
  assertEquals(semantic_no_whitespace_texts(tokens), ["a", "+"]);
});
