import type { Pattern } from "./patterns/mod.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { Memos } from "../memo.ts";
import {
  DefaultModule,
  type Func,
  isFunc,
  type Module,
  type Rule,
  type Special,
} from "./modules/mod.ts";
import { Resolver } from "./resolve.ts";
import { globals } from "./runtime.ts";
import { CallStack } from "./stack/call_stack.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";
import { VariableScope } from "./variable_scope.ts";

export type ScopeOptions = {
  trace: boolean;
  specials: Map<string, Special>;
  globals: Map<string, unknown>;
  resolver: Resolver;
};

export type ScopeFromOptions = {
  kind?: InputNormalizationMode;
};

function isCompleteOptions(
  options: Partial<ScopeOptions> | undefined,
): options is ScopeOptions {
  return options?.trace !== undefined &&
    options.specials !== undefined &&
    options.globals !== undefined &&
    options.resolver !== undefined;
}

export class Scope {
  public static readonly Default = (): Scope => new Scope();
  public static readonly From = (
    input: Input | Iterable<unknown> | Iterator<unknown> | unknown,
    options?: ScopeFromOptions,
  ): Scope =>
    Scope.Default().withInput(
      input instanceof Input ? input : Input.From(input, {
        kind: options?.kind ?? InputNormalizationMode.Scalar,
      }),
    );

  public readonly options: ScopeOptions;
  public readonly variables: VariableScope;
  constructor(
    public readonly module: Module = DefaultModule(),
    public readonly parent: Scope | undefined = undefined,
    variables: Map<string, unknown> | VariableScope = VariableScope.Empty,
    public readonly args: Map<string, Rule> = new Map(),
    public readonly stream: Input = Input.Default(),
    public readonly memos: Memos = new Memos(),
    public readonly stack: CallStack = CallStack.Empty,
    options?: Partial<ScopeOptions>,
    /**
     * Whether `recover` patterns may recover from a failed child; part of
     * every memo key (see
     * `.agents/specifications/runtime/error-recovery.spec.md`).
     */
    public readonly recovery: boolean = false,
  ) {
    // Accepting a plain `Map` here too (normalized via `VariableScope.From`)
    // keeps every existing caller that constructs a `Scope` directly with a
    // literal `Map` working unchanged.
    this.variables = VariableScope.From(variables);
    // Every scope derivation (`withInput`, `withMemos`, `addVariables`, ...)
    // constructs a new `Scope` while forwarding an already-complete
    // `options`. Building `DefaultOptions()` unconditionally here — as this
    // used to do — threw away a fresh `new Resolver()` (and the `Deno.cwd()`
    // syscall inside it) on every single one of those derivations, which
    // happens on the order of once per rule invocation during a parse. Only
    // construct a default for whichever field is actually missing. A complete
    // `options` is shared as-is: every match retains its scope, so a copy per
    // derivation is retained once per parse node.
    this.options = isCompleteOptions(options) ? options : {
      trace: options?.trace ?? false,
      specials: options?.specials ?? new Map(),
      globals: options?.globals ?? globals,
      resolver: options?.resolver ?? new Resolver(),
    };
  }

  public get depth(): number {
    return this.stack.depth;
  }

  public getSpecial(name: string): Special | undefined {
    return this.options.specials?.get(name);
  }

  public getRule(name: string): Rule | undefined {
    return this.args.get(name) ?? this.getDeclaredRule(name);
  }

  /** A rule declared in or imported into the module; never a rule argument. */
  public getDeclaredRule(name: string): Rule | undefined {
    if (this.module.rules.has(name)) {
      return this.module.rules.get(name);
    }

    const imported = this.module.imports.get(name);
    if (imported && !isFunc(imported)) {
      return imported;
    }
    return undefined;
  }

  public getFunc(name: string): Func | undefined {
    if (this.module.funcs.has(name)) {
      return this.module.funcs.get(name);
    }

    const imported = this.module.imports.get(name);
    if (imported && isFunc(imported)) {
      return imported;
    }
    return undefined;
  }

  public withInput(input: Input): Scope {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      input,
      this.memos,
      this.stack,
      this.options,
      this.recovery,
    );
  }

  /// <summary>
  /// Returns a scope backed by the given memo table instead of this scope's
  /// own. Used to seed a reparse with a memo table rehydrated from a prior
  /// parse's delivered result (see incremental re-parsing).
  /// </summary>
  public withMemos(memos: Memos): Scope {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      this.stream,
      memos,
      this.stack,
      this.options,
      this.recovery,
    );
  }

  public withInputValue(
    input: Iterable<unknown> | Iterator<unknown> | unknown,
    options?: ScopeFromOptions,
  ): Scope {
    return this.withInput(
      Input.From(input, {
        kind: options?.kind ?? InputNormalizationMode.Scalar,
      }),
    );
  }

  public addVariable(name: string, value: unknown): Scope {
    return new Scope(
      this.module,
      this.parent,
      this.variables.withBinding(name, value),
      this.args,
      this.stream,
      this.memos,
      this.stack,
      this.options,
      this.recovery,
    );
  }

  public addVariables(
    variables:
      | Record<string, unknown>
      | Map<string, unknown>
      | VariableScope,
  ): Scope {
    const nextVariables = variables instanceof VariableScope
      ? this.variables.withScope(variables)
      : this.variables.with(variables);
    return new Scope(
      this.module,
      this.parent,
      nextVariables,
      this.args,
      this.stream,
      this.memos,
      this.stack,
      this.options,
      this.recovery,
    );
  }

  public pushRule(rule: Rule, args: Map<string, Rule>): Scope {
    return new Scope(
      this.module,
      this.parent,
      rule.closureVariables ?? new Map(),
      args,
      this.stream,
      this.memos,
      this.stack.push({ kind: StackFrameKind.Rule, rule }),
      this.options,
      this.recovery,
    );
  }

  public pushFunc(fn: Func): Scope {
    return new Scope(
      fn.module,
      undefined,
      VariableScope.Empty,
      new Map(),
      this.stream,
      this.memos,
      this.module !== fn.module
        ? this.stack.push({ kind: StackFrameKind.Module, module: fn.module })
        : this.stack,
      this.options,
      this.recovery,
    );
  }

  public pushPipeline(pipeline: Pattern): Scope {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      this.stream,
      this.memos,
      this.stack.push({ kind: StackFrameKind.Pipeline, pipeline }),
      this.options,
      this.recovery,
    );
  }

  public pushModule(module: Module): Scope {
    if (this.module === module) {
      return this;
    }
    return new Scope(
      module,
      undefined,
      new Map(),
      new Map(),
      this.stream,
      this.memos,
      this.module !== module
        ? this.stack.push({ kind: StackFrameKind.Module, module })
        : this.stack,
      this.options,
      this.recovery,
    );
  }

  /// <summary>
  /// The scope should be the original scope from before the rule was pushed.
  /// The entire original scope is returned, except for the stream and memos.
  /// </summary>
  public pop(scope: Scope): Scope {
    return new Scope(
      scope.module,
      scope.parent,
      scope.variables,
      scope.args,
      this.stream,
      this.memos,
      scope.stack,
      scope.options,
      scope.recovery,
    );
  }

  public withOptions(options: Partial<ScopeOptions>): Scope {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      this.stream,
      this.memos,
      this.stack,
      {
        trace: options.trace ?? this.options.trace,
        specials: options.specials ?? this.options.specials,
        globals: options.globals ?? this.options.globals,
        resolver: options.resolver ?? this.options.resolver,
      },
      this.recovery,
    );
  }

  /** This scope with recovery enabled or disabled; itself when unchanged. */
  public withRecovery(recovery: boolean): Scope {
    if (this.recovery === recovery) return this;
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      this.stream,
      this.memos,
      this.stack,
      this.options,
      recovery,
    );
  }
}
