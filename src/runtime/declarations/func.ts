import type { Expression } from "../expressions/expression.ts";
import type { Pattern } from "../patterns/mod.ts";

/**
 * Author-defined callable. `pattern` matches the invocation argument list as an
 * iterable stream (typically Then of variable captures; End when no params).
 */
export type FuncDeclaration = {
  name: string;
  pattern: Pattern;
  expression: Expression;
};
