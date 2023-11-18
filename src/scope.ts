import { Pattern } from "./runtime/patterns/mod.ts";
import { Input } from "./input.ts";
import { Memos } from "./memo.ts";
import { IImport, IModule, IRule, ModuleKind } from "./modules.ts";
import { Resolver } from "./runtime/resolve.ts";
import { runtime } from "./runtime/runtime.ts";

export type SpecialType =
  | IModule
  | IRule
  | IImport
  | ((...args: unknown[]) => unknown);

export interface IScopeOptions {
  trace: boolean;
  specials: Map<string, SpecialType>;
  globals: Record<string, unknown>;
  resolver: Resolver;
}

export const DefaultModule: IModule = {
  kind: ModuleKind.Module,
  moduleUrl: import.meta.url,
  imports: new Map(),
  rules: new Map(),
};

export const DefaultOptions: () => IScopeOptions = () => ({
  globals: runtime,
  specials: new Map(),
  trace: false,
  resolver: new Resolver(),
});

export class Scope {
  public static readonly Default = (
    args?: { module?: IModule } & Partial<IScopeOptions>,
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
    args?: { module?: IModule } & Partial<IScopeOptions>,
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
    public readonly module: IModule,
    public readonly options: IScopeOptions,
    public readonly parent: Scope | undefined = undefined,
    public readonly variables: Record<string, unknown>,
    public readonly stream: Input,
    public readonly memos: Memos,
    public readonly ruleStack: IRule[],
    public readonly pipelineStack: Pattern[],
    public readonly moduleStack: IModule[],
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

  public getRule(name: string): IRule | undefined {
    if (this.module.rules.has(name)) {
      return this.module.rules.get(name);
    } else if (this.module.imports.has(name)) {
      return this.module
        .imports.get(name)!
        .module
        .rules.get(name);
    }
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

  public pushRule(rule: IRule) {
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

  public pushModule(module: IModule) {
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
