import { Pattern } from "./runtime/patterns/mod.ts";
import { Input } from "./input.ts";
import { Memos } from "./memo.ts";
import { DefaultModule, Module, Rule, Special } from "./runtime/modules/mod.ts";
import { Resolver } from "./runtime/resolve.ts";
import { runtime } from "./runtime/runtime.ts";

export interface IScopeOptions {
  trace: boolean;
  specials: Map<string, Special>;
  globals: Record<string, unknown>;
  resolver: Resolver;
}

export const DefaultOptions: () => IScopeOptions = () => ({
  globals: runtime,
  specials: new Map(),
  trace: false,
  resolver: new Resolver(),
});

export class Scope {
  public static readonly Default = (
    args?: { module?: Module } & Partial<IScopeOptions>,
  ) => {
    const { module, ...options } = args ?? {};
    return new Scope(
      module ?? DefaultModule,
      { ...DefaultOptions(), ...options ?? {} },
      undefined,
      {},
      Input.Default(),
      new Memos(),
      [],
      [],
      [],
    );
  };

  public static readonly From = (
    stream: Iterable<unknown> | Input | Scope,
    args?: { module?: Module } & Partial<IScopeOptions>,
  ) => {
    const { module, ...options } = args ?? {};
    return stream instanceof Scope
      ? new Scope(
        module ?? stream.module,
        { ...DefaultOptions(), ...stream.options, ...options },
        stream.parent,
        stream.variables,
        stream.stream,
        stream.memos,
        stream.ruleStack,
        stream.pipelineStack,
        stream.moduleStack,
      )
      : new Scope(
        module ?? DefaultModule,
        { ...DefaultOptions(), ...options },
        undefined,
        {},
        Input.From(stream),
        new Memos(),
        [],
        [],
        [],
      );
  };

  constructor(
    public readonly module: Module,
    public readonly options: IScopeOptions,
    public readonly parent: Scope | undefined = undefined,
    public readonly variables: Record<string, unknown>,
    public readonly stream: Input,
    public readonly memos: Memos,
    public readonly ruleStack: Rule[],
    public readonly pipelineStack: Pattern[],
    public readonly moduleStack: Module[],
  ) {
  }

  public *stack() {
    yield this;

    let current: Scope | undefined = this.parent;
    while (current) {
      yield current;
      current = current.parent;
    }
  }

  public get depth() {
    return this.pipelineStack.length + this.ruleStack.length;
  }

  public getSpecial(name: string) {
    return this.options.specials?.get(name);
  }

  public getRule(name: string): Rule | undefined {
    return this.module.rules.has(name)
      ? this.module.rules.get(name)
      : this.module.imports.get(name)?.module.rules.get(name);
  }

  public withStream(stream: Input) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      this.variables,
      stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
    );
  }

  public addVariables(variables: Record<string, unknown>) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      Object.assign({}, this.variables, variables),
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
    );
  }

  public setVariables(variables: Record<string, unknown>) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      Object.assign({}, this.variables, variables),
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
    );
  }

  public pushRule(rule: Rule) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      {},
      this.stream,
      this.memos,
      [...this.ruleStack, rule],
      this.pipelineStack,
      this.moduleStack,
    );
  }

  public pushPipeline(pattern: Pattern) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      {},
      this.stream,
      this.memos,
      this.ruleStack,
      [...this.pipelineStack, pattern],
      this.moduleStack,
    );
  }

  public pushModule(module: Module) {
    if (this.module === module) {
      return this;
    }
    return new Scope(
      module,
      this.options,
      undefined,
      {},
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.module !== module ? [...this.moduleStack, module] : this.moduleStack,
    );
  }

  /// <summary>
  /// The scope should be the original scope from before the rule was pushed.
  /// The entire original scope is returned, except for the stream and memos.
  /// </summary>
  public pop(scope: Scope) {
    return new Scope(
      scope.module,
      scope.options,
      scope.parent,
      scope.variables,
      this.stream,
      this.memos,
      scope.ruleStack,
      scope.pipelineStack,
      scope.moduleStack,
    );
  }
}
