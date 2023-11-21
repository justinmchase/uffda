import { Declaration, DeclarationKind } from "../declarations/mod.ts";
import { Pattern, PatternKind } from "../patterns/mod.ts";
import {
  ArrayInitializer,
  Expression,
  ExpressionKind,
  ObjectInitializer,
} from "../expressions/mod.ts";
import { Serializable } from "serializable/mod.ts";

export function serialize(
  declaration:
    | Declaration
    | Pattern
    | Expression
    | ArrayInitializer
    | ObjectInitializer,
): Serializable {
  const { kind } = declaration;
  switch (kind) {
    // PATTERNS
    case PatternKind.Any:
    case PatternKind.Boolean:
    case PatternKind.End:
    case PatternKind.Fail:
    case PatternKind.Number:
    case PatternKind.Ok:
    case PatternKind.String: {
      const { kind } = declaration;
      return { kind };
    }
    case PatternKind.And:
    case PatternKind.Or:
    case PatternKind.Then: {
      const { kind, patterns } = declaration;
      return {
        kind,
        patterns: patterns.map((p) => serialize(p)),
      };
    }
    case PatternKind.Array:
    case PatternKind.Not: {
      const { kind, pattern } = declaration;
      return {
        kind,
        pattern: serialize(pattern),
      };
    }
    case PatternKind.Equal: {
      const { kind, value } = declaration;
      return { kind, value };
    }
    case PatternKind.Includes: {
      const { kind, values } = declaration;
      return { kind, values };
    }
    case PatternKind.Until:
    case PatternKind.Must: {
      const { kind, message, name, pattern } = declaration;
      return { kind, message, name, pattern: serialize(pattern) };
    }
    case PatternKind.Object: {
      const { kind, keys } = declaration;
      return {
        kind,
        keys: !keys ? keys : Object
          .entries(keys)
          .reduce<Record<string, Serializable>>(
            (r, [k, v]) => Object.assign(r, { [k]: serialize(v) }),
            {},
          ),
      };
    }
    case PatternKind.Pipeline: {
      const { kind, steps } = declaration;
      return { kind, steps: steps.map((s) => serialize(s)) };
    }
    case PatternKind.Projection: {
      const { kind, pattern, expression } = declaration;
      return {
        kind,
        pattern: serialize(pattern),
        expression: serialize(expression),
      };
    }
    case PatternKind.Range: {
      const { kind, left, right } = declaration;
      return { kind, left, right };
    }
    case PatternKind.Special:
    case PatternKind.Reference: {
      const { kind, name } = declaration;
      return { kind, name };
    }
    case PatternKind.RegExp: {
      const { kind, pattern } = declaration;
      return { kind, pattern: pattern.toString() };
    }
    case PatternKind.Slice: {
      const { kind, min, max } = declaration;
      return { kind, min, max };
    }
    case PatternKind.Variable: {
      const { kind, name, pattern } = declaration;
      return { kind, name, pattern: serialize(pattern) };
    }

    // EXPRESSIONS

    case ExpressionKind.Array: {
      const { kind, expressions } = declaration;
      return {
        kind,
        expressions: expressions.map((e) => serialize(e.expression)),
      };
    }
    case ExpressionKind.ArrayElement:
    case ExpressionKind.ArraySpread:
    case ExpressionKind.ObjectSpread: {
      const { kind, expression } = declaration;
      return { kind, expression: serialize(expression) };
    }
    case ExpressionKind.Binary: {
      const { kind, left, op, right } = declaration;
      return {
        kind,
        left: serialize(left),
        op,
        right: serialize(right),
      };
    }
    case ExpressionKind.Invocation: {
      const { kind, expression, args } = declaration;
      return {
        kind,
        expression: serialize(expression),
        args: args.map((a) => serialize(a)),
      };
    }
    case ExpressionKind.Lambda: {
      const { kind, pattern, expression } = declaration;
      return {
        kind,
        pattern: serialize(pattern),
        expression: serialize(expression),
      };
    }
    case ExpressionKind.ObjectKey:
    case ExpressionKind.Member: {
      const { kind, name, expression } = declaration;
      return {
        kind,
        name,
        expression: serialize(expression),
      };
    }
    case ExpressionKind.Native: {
      const { kind, fn } = declaration;
      return {
        kind,
        fn: fn.toString(),
      };
    }
    case ExpressionKind.Object: {
      const { kind, keys } = declaration;
      return {
        kind,
        keys: keys.map((k) => serialize(k)),
      };
    }
    case ExpressionKind.Reference:
    case ExpressionKind.Special: {
      const { kind, name } = declaration;
      return {
        kind,
        name,
      };
    }
    case ExpressionKind.Value: {
      const { kind, value } = declaration;
      return {
        kind,
        value,
      };
    }

    // DECLARATIONS

    case DeclarationKind.Module: {
      const { kind, imports, rules } = declaration;
      return {
        kind,
        imports: imports.map((i) => serialize(i)),
        rules: rules.map((r) => serialize(r)),
      };
    }
    case DeclarationKind.Import: {
      const { kind, moduleUrl, names } = declaration;
      return {
        kind,
        moduleUrl,
        names,
      };
    }
    case DeclarationKind.NativeImport: {
      const { kind, moduleUrl, names, module } = declaration;
      return {
        kind,
        moduleUrl,
        names,
        module: serialize(typeof module === "function" ? module() : module),
      };
    }
    case DeclarationKind.Rule: {
      const { kind, name, pattern } = declaration;
      return {
        kind,
        name,
        pattern: serialize(pattern),
      };
    }
    default:
      throw new Error(`Unable to serialize unknown kind ${kind}`);
  }
}
