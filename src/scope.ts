import { assert } from "../deps/std.ts";
import { Pattern } from "./runtime/patterns/mod.ts";
import { MetaStream } from "./stream.ts";
import { Memos } from "./memo.ts";
import { IModule, IRule } from "./modules.ts";
import { RuntimeError, RuntimeErrorCode } from "./runtime/runtime.error.ts";
import { Match } from "./match.ts";
import { isModuleDeclarationTest } from "./test.ts";

export interface IScopeOptions {
  trace?: boolean;
  specials?: Record<string, unknown>;
  globals?: Record<string, unknown>;
}

// todo: Figure out an ideal default modulePath...
// Ideally it would be the Deno main module url, but I don't know how to find that
// Also possible an env var, or maybe cwd(). 
// `modulePath` should probably be a function so it doesn't incur any permissions checks
// until an import is attempted.
export const DefaultModule = { moduleUrl: import.meta.url, imports: new Map(), rules: new Map() };
export const DefaultOptions = { globals: {}, specials: {}, trace: false };

export class Scope {
  public static readonly Default = (args?: { module?: IModule } & IScopeOptions) => {
    const { module, ...options } = args ?? {}
    return new Scope(
      module ?? DefaultModule,
      options ?? DefaultOptions,
      undefined,
      {},
      MetaStream.Default(),
      new Memos(),
      [],
      [],
      [],
    );
  }

  public static readonly From = (
    stream: Iterable<unknown> | MetaStream | Scope,
    args?: { module?: IModule } & IScopeOptions
  ) => {
    const { module, ...options } = args ?? {};
    return stream instanceof Scope
      ? new Scope(
          module ?? stream.module,
          { ...stream.options, ...options },
          stream.parent,
          stream.variables,
          stream.stream,
          stream.memos,
          stream.ruleStack,
          stream.pipelineStack,
          stream.moduleStack
        )
      : new Scope(
          module ?? DefaultModule,
          options ?? DefaultOptions,
          undefined,
          {},
          MetaStream.From(stream),
          new Memos(),
          [],
          [],
          [],
        );
  }

  constructor(
    public readonly module: IModule,
    public readonly options: IScopeOptions,
    public readonly parent: Scope | undefined = undefined,
    public readonly variables: Record<string, unknown>,
    public readonly stream: MetaStream,
    public readonly memos: Memos,
    public readonly ruleStack: IRule[],
    public readonly pipelineStack: Pattern[],
    public readonly moduleStack: IModule[]
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
    return this.options.specials?.[name];
  }

  public getRule(name: string): IRule | undefined {
    if (this.module.rules.has(name)) {
      return this.module.rules.get(name);
    } else if (this.module.imports.has(name)) {
      return this.module
        .imports.get(name)!
        .module
        .rules.get(name)
    }
  }
  
  public withStream(stream: MetaStream) {
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
      this.moduleStack
    );
  }

  public pushPipeline(pattern: Pattern, stream: MetaStream) {
    return new Scope(
      this.module,
      this.options,
      this.parent,
      {},
      stream,
      this.memos,
      this.ruleStack,
      [...this.pipelineStack, pattern],
      this.moduleStack
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
      this.module !== module
        ? [...this.moduleStack, module]
        : this.moduleStack
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

  // public push() {
  //   return new Scope(
  //     this,
  //     {},
  //     this._specials,
  //     this._rules,
  //     this.options,
  //     this.stream,
  //     this.memos,
  //     this.ruleStack,
  //     this.refStack,
  //     this.pipelineStack,
  //   );
  // }

  // public pop() {
  //   assert(this._parent, "Assymetrical push and pop");
  //   return new Scope(
  //     this._parent!._parent,
  //     this._parent!._variables,
  //     this._parent!._specials,
  //     this._parent!._rules,
  //     this.options,
  //     this.stream,
  //     this.memos,
  //     this.ruleStack,
  //     this.refStack,
  //     this.pipelineStack,
  //   );
  // }
}
