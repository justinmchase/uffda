import { tests } from "../../test.ts";
import { Token } from "./Token.ts";

tests(() => [
  {
    id: "TOKEN00",
    description: "does not match a letter",
    module: () => Token,
    input: "a",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN01",
    description: "does not match a digit",
    module: () => Token,
    input: "1",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN02",
    description: "does not match whitespace",
    module: () => Token,
    input: " ",
    matched: false,
    done: false,
  },
  {
    id: "TOKEN03",
    description: "matches a non-letter, non-digit, non-whitespace",
    module: () => Token,
    input: "*",
    value: "*",
  },
]);
