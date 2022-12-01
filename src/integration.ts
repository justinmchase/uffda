import { equal, green, magenta, red, yellow, path, brightBlack } from "../deps/std.ts";
import { assert } from "../deps/std.ts";
import { Resolver, run, Scope } from "./mod.ts";

type IntegrationArgs = {
  // Debug
  only?: boolean;
  trace?: boolean;
  future?: string;

  // Input
  moduleUrl: string;
  input: string;

  // Assertions
  matched?: boolean;
  done?: boolean;
  expected?: unknown;
};

const testCounts = new Map<string, number>();

function testInfo(callStack: string) {
  const lastLine = callStack.split('\n').slice(-1)[0] // last line of the call stack
  const parts = lastLine.slice("    at ".length).split(':')
  const urlParts = parts.slice(0, -2)
  const line = parts.slice(-2, -1)
  const column = parts.slice(-1)
  const importMetaUrl = urlParts.join(':');

  const testPath = `./${importMetaUrl.split('/src/')[1]}`;


  const fileName = path.basename(testPath, path.extname(testPath))
  const dirName = path.dirname(testPath);
  const name = `${dirName.slice(2).replace('/', '.')}.${fileName}`
  
  const count = (testCounts.get(name) ?? 0) + 1
  testCounts.set(name, count);
  return {
    importMetaUrl: urlParts.join(':'),
    line,
    column,
    name: `${name.toUpperCase()}:${count.toString().padStart(4, '0')}`
  }
}

export function integration(args: IntegrationArgs) {
  const {
    only,
    trace,
    future,
    moduleUrl,
    input,
    expected,
    matched = true,
    done = true,
  } = args;
  
  const { stack = '' } = new Error()
  const { name, importMetaUrl, line, column } = testInfo(stack)
  return {
    only,
    ignore: !!future,
    name: `[${magenta(name)}] ${future ? yellow(future) : moduleUrl}`,
    fn: async () => {
      if (future) return;
      const resolver = new Resolver(importMetaUrl);
      const mod = await resolver.load(moduleUrl);
      const scope = Scope.From(input, {
        module: mod,
        trace,
      });
      const match = run(scope);
      
      const matchedMessage = match.matched === matched
        ? `${green('matched')}: ${Deno.inspect(match.matched)}`
        : `${red('matched')}: ${Deno.inspect(match.matched)}`
      ;
      const doneMessage = match.done === done
        ? `${green('done')}: ${Deno.inspect(match.done)}`
        : `${red('done')}: ${Deno.inspect(match.done)}`
      ;
      const valueMessage = equal(match.value, expected)
        ? ''
        : `${yellow('expected')}: ${Deno.inspect(expected, { colors: true, depth: 10 })}\n` +
          `${red('actual')}: ${Deno.inspect(match.value, { colors: true, depth: 10 })}`
        ;
      assert(
        equal(match.matched, matched) &&
        equal(match.done, done) &&
        equal(match.value, expected),
        `Module failed to parse:\n` +
        `${brightBlack('test')}: [${magenta(name)}]\n` +
        `${brightBlack('testUrl')}: ${importMetaUrl}:${line}:${column}\n` +
        `${brightBlack('moduleUrl')}: ${moduleUrl}\n` +
        `${matchedMessage}\n` +
        `${doneMessage}\n` + 
        `${valueMessage}\n`,
      );
    },
  };
}
