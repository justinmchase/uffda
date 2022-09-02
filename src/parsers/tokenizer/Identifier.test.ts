import { tests } from "../../test.ts";
import { Identifier } from "./Identifier.ts";

tests(() => [
  {
    id: "IDENTIFIER00",
    description: "matches a character",
    pattern: () => Identifier,
    input: "a",
    value: "a",
  },
  {
    id: "IDENTIFIER01",
    description: "matches a word",
    pattern: () => Identifier,
    input: "abc",
    value: "abc",
  },
  {
    id: "IDENTIFIER02",
    description: "does not match a leading digit",
    pattern: () => Identifier,
    input: "1abc",
    matched: false,
    done: false,
  },
  {
    id: "IDENTIFIER03",
    description: "matches a word followed by digits",
    pattern: () => Identifier,
    input: "abc123",
    value: "abc123",
  },
  {
    id: "IDENTIFIER04",
    description: "matches interleaved letters and numbers",
    pattern: () => Identifier,
    input: "a1b2c3",
    value: "a1b2c3",
  },
  {
    id: "IDENTIFIER05",
    description: "does not match punctuation",
    pattern: () => Identifier,
    input: "a.b",
    value: "a",
    done: false,
  },
]);
