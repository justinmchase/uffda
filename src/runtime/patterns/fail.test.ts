import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

tests(() => [
  {
    id: "FAIL00",
    description: "fail pattern fails",
    pattern: () => ({ kind: PatternKind.Fail }),
    input: "a",
    matched: false,
    done: false,
  },
]);
