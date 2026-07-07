import type { Match } from "../match.ts";

export type Awaitable<T> = T | Promise<T>;

export type AwaitableMatch = Promise<Match>;
