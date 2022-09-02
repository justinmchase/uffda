import { tests } from "../../test.ts";
import { Integer } from "./Integer.ts";

tests(() => [
  {
    id: "INTEGER00",
    description: "can match a single digit",
    pattern: () => Integer,
    input: "1",
    value: "1",
  },
  {
    id: "INTEGER01",
    description: "can match multiple digits",
    pattern: () => Integer,
    input: "123",
    value: "123",
  },
  {
    id: "INTEGER02",
    description: "does not match a letter",
    pattern: () => Integer,
    input: "a",
    matched: false,
    done: false,
  },
  {
    id: "INTEGER03",
    description: "does not match a symbol",
    pattern: () => Integer,
    input: "*",
    matched: false,
    done: false,
  },
  {
    id: "INTEGER04",
    description: "does not match letters after an integer",
    pattern: () => Integer,
    input: "123ms",
    value: "123",
    done: false,
  },
  {
    id: "INTEGER05",
    description: "does not match float remainder",
    pattern: () => Integer,
    input: "7.11",
    value: "7",
    done: false,
  },
]);
