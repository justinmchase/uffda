import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(import.meta.url, () => [
  {
    id: "OKPATTERN00",
    description: "parses OkPattern into ok",
    pattern: () => Meta,
    input: "ok",
    value: { kind: PatternKind.Ok },
  },
]);
