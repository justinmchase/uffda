import { tests } from "../../test.ts";
import { String } from "./String.ts";

tests(() => [
  {
    id: "STRING00",
    description: "can parse empty single quote string",
    module: () => String,
    input: "''",
    value: "",
  },
  {
    id: "STRING01",
    description: "can parse single quote string",
    module: () => String,
    input: "'a'",
    value: "a",
  },
  {
    id: "STRING02",
    description: "can parse single quote string with multiple characters",
    module: () => String,
    input: "'abc'",
    value: "abc",
  },
  {
    id: "STRING03",
    description: "can parse string with escaped single-quote",
    module: () => String,
    input: "'abc\\'xyz'",
    value: "abc'xyz",
  },
  {
    id: "STRING04",
    description: "can parse string with escaped single-quote",
    module: () => String,
    input: "'\\''",
    value: "'",
  },
  {
    id: "STRING04",
    description: "can parse string with escaped single-quote",
    module: () => String,
    input: "'\"'",
    value: "\"",
  },
]);
