import { Pattern } from "./patterns/mod.ts";
import { Input } from "../input.ts";
import { Memos } from "../memo.ts";
import { DefaultModule, Module, Rule, Special } from "./modules/mod.ts";
import { Resolver } from "./resolve.ts";
import { globals } from "./runtime.ts";
import { StackFrame } from "./stack/frame.ts";
import { StackFrameKind } from "./stack/stackFrameKind.ts";

export type ScopeOptions = {
  trace: boolean;
  specials: Map<string, Special>;
  globals: Map<string, unknown>;
  resolver: Resolver;
};

export const DefaultOptions: () => ScopeOptions = () => ({
  globals,
  specials: new Map(),
  trace: false,
  resolver: new Resolver(),
});

export class Scope {
  public static readonly Default = () => new Scope();
  public static readonly From = (
    input: Input | Iterable<unknown> | Iterator<unknown>,
  ) =>
    Scope.Default().withInput(
      input instanceof Input ? input : Input.From(input),
    );

  public readonly options: ScopeOptions;
  constructor(
    public readonly module: Module = DefaultModule(),
    public readonly parent: Scope | undefined = undefined,
    public readonly variables: Map<string, unknown> = new Map(),
    public readonly args: Map<string, Rule> = new Map(),
    public readonly stream: Input = Input.Default(),
    public readonly memos: Memos = new Memos(),
    public readonly stack: StackFrame[] = [],
    options?: Partial<ScopeOptions>,
  ) {
    this.options = {
      ...DefaultOptions(),
      ...options,
    };
  }

  public get depth() {
    return this.stack.length;
  }

  public getSpecial(name: string) {
    return this.options.specials?.get(name);
  }

  public getRule(name: string): Rule | undefined {
    return this.args.has(name)
      ? this.args.get(name)
      : this.module.rules.has(name)
      ? this.module.rules.get(name)
      : this.module.imports.get(name)?.module.rules.get(name);
  }

  public withInput(input: Input) {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      input,
      this.memos,
      this.stack,
      this.options,
    );
  }

  public addVariables(
    variables: Record<string, unknown> | Map<string, unknown>,
  ) {
    if (!(variables instanceof Map)) {
      variables = new Map(Object.entries(variables));
    }
    return new Scope(
      this.module,
      this.parent,
      new Map([...this.variables, ...variables]),
      this.args,
      this.stream,
      this.memos,
      this.stack,
      this.options,
    );
  }

  public pushRule(rule: Rule, args: Map<string, Rule>) {
    return new Scope(
      this.module,
      this.parent,
      new Map(),
      args,
      this.stream,
      this.memos,
      [...this.stack, { kind: StackFrameKind.Rule, rule }],
      this.options,
    );
  }

  public pushPipeline(pipeline: Pattern) {
    return new Scope(
      this.module,
      this.parent,
      new Map(),
      new Map(),
      this.stream,
      this.memos,
      [...this.stack, { kind: StackFrameKind.Pipeline, pipeline }],
      this.options,
    );
  }

  public pushModule(module: Module) {
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
        ? [...this.stack, { kind: StackFrameKind.Module, module }]
        : this.stack,
      this.options,
    );
  }

  /// <summary>
  /// The scope should be the original scope from before the rule was pushed.
  /// The entire original scope is returned, except for the stream and memos.
  /// </summary>
  public pop(scope: Scope) {
    return new Scope(
      scope.module,
      scope.parent,
      scope.variables,
      scope.args,
      this.stream,
      this.memos,
      scope.stack,
      scope.options,
    );
  }

  public withOptions(options: Partial<ScopeOptions>) {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.args,
      this.stream,
      this.memos,
      this.stack,
      {
        ...this.options,
        ...options,
      },
    );
  }
}
