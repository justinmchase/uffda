import { Pattern } from "./patterns/mod.ts";
import { Input } from "../input.ts";
import { Memos } from "../memo.ts";
import { DefaultModule, Module, Rule, Special } from "./modules/mod.ts";
import { Resolver } from "./resolve.ts";
import { runtime } from "./runtime.ts";

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
  public static readonly Default = () => new Scope();
  public readonly options: IScopeOptions;
  constructor(
    public readonly module: Module = DefaultModule(),
    public readonly parent: Scope | undefined = undefined,
    public readonly variables: Record<string, unknown> = {},
    public readonly stream: Input = Input.Default(),
    public readonly memos: Memos = new Memos(),
    public readonly ruleStack: Rule[] = [],
    public readonly pipelineStack: Pattern[] = [],
    public readonly moduleStack: Module[] = [],
    options?: Partial<IScopeOptions>,
  ) {
    this.options = {
      ...DefaultOptions(),
      ...options,
    };
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

  public withInput(input: Input) {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      input,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
      this.options,
    );
  }

  public addVariables(variables: Record<string, unknown>) {
    return new Scope(
      this.module,
      this.parent,
      Object.assign({}, this.variables, variables),
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
      this.options,
    );
  }

  public setVariables(variables: Record<string, unknown>) {
    return new Scope(
      this.module,
      this.parent,
      Object.assign({}, this.variables, variables),
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
      this.options,
    );
  }

  public pushRule(rule: Rule) {
    return new Scope(
      this.module,
      this.parent,
      {},
      this.stream,
      this.memos,
      [...this.ruleStack, rule],
      this.pipelineStack,
      this.moduleStack,
      this.options,
    );
  }

  public pushPipeline(pattern: Pattern) {
    return new Scope(
      this.module,
      this.parent,
      {},
      this.stream,
      this.memos,
      this.ruleStack,
      [...this.pipelineStack, pattern],
      this.moduleStack,
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
      {},
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.module !== module ? [...this.moduleStack, module] : this.moduleStack,
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
      this.stream,
      this.memos,
      scope.ruleStack,
      scope.pipelineStack,
      scope.moduleStack,
      scope.options,
    );
  }

  public withOptions(options: Partial<IScopeOptions>) {
    return new Scope(
      this.module,
      this.parent,
      this.variables,
      this.stream,
      this.memos,
      this.ruleStack,
      this.pipelineStack,
      this.moduleStack,
      {
        ...this.options,
        ...options,
      },
    );
  }
}
