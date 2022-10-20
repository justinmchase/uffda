import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "LAMBDA00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
      b: 11,
    }),
    result: 18,
    expression: () => ({
      kind: ExpressionKind.Invocation,
      args: [],
      expression: {
        kind: ExpressionKind.Lambda,
        pattern: {
          kind: PatternKind.Not,
          pattern: {
            kind: PatternKind.Any
          }
        },
        expression: {
          kind: ExpressionKind.Add,
          left: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
          right: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        }
      }
    }),
  },

  // todo: more tests...
]);
