import { Calc } from "./calc.ts";
import { tests } from "../test.ts";

tests(() => [
  {
    id: "CALC00",
    pattern: () => Calc,
    input: "7",
    value: 7,
  },
  {
    id: "CALC01",
    pattern: () => Calc,
    input: "7 + 11",
    value: 18,
  },
  {
    id: "CALC02",
    pattern: () => Calc,
    input: "7 + 11 + 100",
    value: 118,
  },
  {
    id: "CALC03",
    pattern: () => Calc,
    input: "11 - 7",
    value: 4,
  },
  {
    id: "CALC04",
    pattern: () => Calc,
    input: "3 - 2 - 1",
    value: 0,
  },
  {
    id: "CALC05",
    pattern: () => Calc,
    input: "1 + 2 - 3 + 4",
    value: 4,
  },
]);
