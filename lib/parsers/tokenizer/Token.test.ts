import { tests } from "../../test.ts";
import { Token } from "./Token.ts";

tests(import.meta.url, () => [
  {
    id: "TOKEN00",
    description: "does not match a letter",
    pattern: () => Token,
    input: "a",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN01",
    description: "does not match a digit",
    pattern: () => Token,
    input: "1",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN02",
    description: "does not match whitespace",
    pattern: () => Token,
    input: " ",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN03",
    description: "matches a non-letter, non-digit, non-whitespace",
    pattern: () => Token,
    input: "*",
    value: "*",
  },
]);
