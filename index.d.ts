// TypeScript 5.4+. CommonJS exports with Node ESM interoperability.
// Runtime validation remains authoritative for JavaScript/unknown inputs.
export as namespace Functions;

type AnyFunction = (this: any, ...args: any[]) => any;
type Nullish = null | undefined;
type MaybeFunction = AnyFunction | Nullish;
// Without a known call context, callbacks must describe their own inputs.
// A restrictive contextual rest prevents unannotated fallback bodies from receiving any.
// The zero-argument alternative preserves parameter defaults without granting input members.
type UncontextualizedCallback = ((...args: never[]) => unknown) | (() => unknown);
// Resolve the contextual tuple before checking the callback, so omitted parameters
// retain their initializer types. The captured callback below still checks every
// actual argument and tuple alternative, including explicitly supplied undefined.
type ContextualSignature<Args extends unknown[], Value> = Args extends [...infer Context]
  ? (this: void, ...args: Context) => Value
  : never;
type ContextualCallback<Args extends unknown[], Value> = [Args[number]] extends [undefined]
  ? ContextualSignature<Args, Value> | ((this: void) => Value)
  : ContextualSignature<Args, Value>;
type ContextualArguments<F> = [F] extends [AnyFunction] ? CapturedCall<F>['args'] : unknown[];
type DefaultableCall<F> = [F] extends [AnyFunction]
  ? Parameters<F> extends Required<Parameters<F>>
    ? unknown extends Parameters<F>[number]
      ? never
      : undefined extends Parameters<F>[number]
        ? unknown
        : never
    : unknown
  : unknown;
type MaybeCallback = UncontextualizedCallback | Nullish;
type Intersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Compact<S extends readonly unknown[]> = S extends readonly [infer H, ...infer T]
  ? H extends Nullish
    ? Compact<T>
    : H extends AnyFunction
      ? [H, ...Compact<T>]
      : never
  : S extends readonly []
    ? []
    : Exclude<S[number], Nullish> extends AnyFunction
      ? Exclude<S[number], Nullish>[]
      : never;
type StageValue<F extends AnyFunction, Async extends boolean> = Async extends true
  ? Awaited<ReturnType<F>>
  : ReturnType<F>;
// Pair accepted arguments with the same captured signature used by ReturnType.
// An earlier overload must not validate inputs for a different captured result.
type AcceptsArguments<F extends AnyFunction, Args extends unknown[]> = [
  F extends unknown ? (Args extends OpenArguments<Parameters<F>> ? true : false) : never
] extends [true]
  ? true
  : false;
// The first stage may be variadic and need not accept its own output. Validate only
// actual hand-offs; an unknown-length tail must accept the first result and its own
// possible results on each subsequent iteration.
type ValidContinuation<Value, Tail extends readonly AnyFunction[], Async extends boolean> = Tail extends readonly [
  infer Next extends AnyFunction,
  ...infer Rest extends AnyFunction[]
]
  ? AcceptsArguments<Next, [Value]> extends true
    ? ValidContinuation<StageValue<Next, Async>, Rest, Async>
    : false
  : Tail extends readonly []
    ? true
    : AcceptsArguments<Tail[number], [Value]> extends true
      ? AcceptsArguments<Tail[number], [StageValue<Tail[number], Async>]> extends true
        ? true
        : false
      : false;
type ValidPath<S extends readonly AnyFunction[], Async extends boolean> = S extends readonly [
  infer First extends AnyFunction,
  ...infer Tail extends AnyFunction[]
]
  ? ValidContinuation<StageValue<First, Async>, Tail, Async>
  : S extends readonly []
    ? true
    : AcceptsArguments<S[number], [StageValue<S[number], Async>]> extends true
      ? true
      : false;
type ValidPipeline<S extends readonly MaybeFunction[], Async extends boolean> = [ValidPath<Compact<S>, Async>] extends [
  true
]
  ? unknown
  : never;
type Receivers<S extends readonly AnyFunction[]> = S extends readonly [
  infer H extends AnyFunction,
  ...infer T extends AnyFunction[]
]
  ? CapturedCall<H>['receiver'] & Receivers<T>
  : S extends readonly []
    ? unknown
    : CapturedCall<S[number]>['receiver'];
type LastValue<S extends readonly AnyFunction[]> = S extends readonly [...AnyFunction[], infer L extends AnyFunction]
  ? ReturnType<L>
  : S extends readonly [infer H extends AnyFunction, ...infer T extends AnyFunction[]]
    ? T extends readonly [AnyFunction, ...AnyFunction[]]
      ? LastValue<T>
      : ReturnType<H> | ReturnType<T[number]>
    : ReturnType<S[number]> | undefined;
type MaybePromise<T, Async extends boolean> = Async extends true ? Promise<Awaited<T>> : T;
type Pipeline<S extends readonly AnyFunction[], Async extends boolean> = S extends readonly []
  ? (...args: unknown[]) => MaybePromise<undefined, Async>
  : S extends readonly [infer H extends AnyFunction, ...AnyFunction[]]
    ? (this: Receivers<S>, ...args: CapturedCall<H>['args']) => MaybePromise<LastValue<S>, Async>
    : (this: Receivers<S>, ...args: PredicateRequirements<S>['args']) => MaybePromise<LastValue<S>, Async>;
type SelfReceiver<F extends AnyFunction> = [
  F extends unknown ? (F extends ThisParameterType<F> ? true : false) : never
] extends [true]
  ? unknown
  : never;

/**
 * The outcome of a callback. Check `ok` before reading `value` or `error`; a caught value need not be an `Error`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * A structural cancellation signal accepted by `sleep`, including compatible browser, Node.js and cross-realm signals.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export interface AbortSignalLike {
  /** Whether cancellation has occurred. */
  readonly aborted: boolean;
  /** The exact cancellation reason; used as the rejection value. */
  readonly reason: unknown;
  /** Registers a listener for cancellation. */
  addEventListener(type: 'abort', listener: () => void): void;
  /** Removes a previously registered cancellation listener. */
  removeEventListener(type: 'abort', listener: () => void): void;
}
/**
 * Cancellation options for `sleep`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export interface SleepOptions {
  /** Signal that cancels the pending wait; already-aborted signals reject immediately. */
  signal?: AbortSignalLike | undefined;
}
/**
 * The host timer handle, or `unknown` when ambient timer declarations are absent.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export type TimerHandle = typeof globalThis extends { setTimeout: (...args: any[]) => infer Handle } ? Handle : unknown;

/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * @param stages Nullish entries followed by the retained callback.
 * @returns A pipeline returning the retained stage's exact result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<F extends UncontextualizedCallback>(...stages: [...Nullish[], F]): Pipeline<[F], false>;
/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * @param stage Callback receiving the pipeline arguments.
 * @param skipped Trailing nullish entries, which are ignored.
 * @returns A pipeline returning the retained stage's exact result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<F extends UncontextualizedCallback>(stage: F, ...skipped: Nullish[]): Pipeline<[F], false>;
/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * @param skipped Leading nullish entry, which is ignored.
 * @param stage Callback receiving the pipeline arguments.
 * @param trailing Trailing nullish entries, which are ignored.
 * @returns A pipeline returning the retained stage's exact result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<F extends UncontextualizedCallback>(
  skipped: Nullish,
  stage: F,
  ...trailing: Nullish[]
): Pipeline<[F], false>;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param stages Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe(...stages: Nullish[]): (...args: unknown[]) => undefined;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, R0>(
  f0: (this: T0, ...args: Args) => R0
): (this: T0, ...args: Args) => R0;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, R0, R1>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1
): (this: KnownConstraint<T0> & KnownConstraint<T1>, ...args: Args) => R1;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, R0, R1, R2>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2
): (this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2>, ...args: Args) => R2;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @param f3 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, T3, R0, R1, R2, R3>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2,
  f3: (this: T3, value: R2) => R3
): (this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2> & KnownConstraint<T3>, ...args: Args) => R3;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @param f3 Next stage, receiving exactly one result from the preceding stage.
 * @param f4 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, T3, T4, R0, R1, R2, R3, R4>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2,
  f3: (this: T3, value: R2) => R3,
  f4: (this: T4, value: R3) => R4
): (
  this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2> & KnownConstraint<T3> & KnownConstraint<T4>,
  ...args: Args
) => R4;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @param f3 Next stage, receiving exactly one result from the preceding stage.
 * @param f4 Next stage, receiving exactly one result from the preceding stage.
 * @param f5 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, T3, T4, T5, R0, R1, R2, R3, R4, R5>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2,
  f3: (this: T3, value: R2) => R3,
  f4: (this: T4, value: R3) => R4,
  f5: (this: T5, value: R4) => R5
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5>,
  ...args: Args
) => R5;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @param f3 Next stage, receiving exactly one result from the preceding stage.
 * @param f4 Next stage, receiving exactly one result from the preceding stage.
 * @param f5 Next stage, receiving exactly one result from the preceding stage.
 * @param f6 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, T3, T4, T5, T6, R0, R1, R2, R3, R4, R5, R6>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2,
  f3: (this: T3, value: R2) => R3,
  f4: (this: T4, value: R3) => R4,
  f5: (this: T5, value: R4) => R5,
  f6: (this: T6, value: R5) => R6
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5> &
    KnownConstraint<T6>,
  ...args: Args
) => R6;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one result from the preceding stage.
 * @param f2 Next stage, receiving exactly one result from the preceding stage.
 * @param f3 Next stage, receiving exactly one result from the preceding stage.
 * @param f4 Next stage, receiving exactly one result from the preceding stage.
 * @param f5 Next stage, receiving exactly one result from the preceding stage.
 * @param f6 Next stage, receiving exactly one result from the preceding stage.
 * @param f7 Next stage, receiving exactly one result from the preceding stage.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<Args extends unknown[], T0, T1, T2, T3, T4, T5, T6, T7, R0, R1, R2, R3, R4, R5, R6, R7>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: R0) => R1,
  f2: (this: T2, value: R1) => R2,
  f3: (this: T3, value: R2) => R3,
  f4: (this: T4, value: R3) => R4,
  f5: (this: T5, value: R4) => R5,
  f6: (this: T6, value: R5) => R6,
  f7: (this: T7, value: R6) => R7
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5> &
    KnownConstraint<T6> &
    KnownConstraint<T7>,
  ...args: Args
) => R7;
/**
 * Creates a function that runs synchronous stages from left to right.
 * The first stage receives all call arguments; each later stage receives the preceding
 * result. Stages share the caller's `this`. Nullish stages are skipped, and promises are
 * passed through without awaiting. For nullish gaps and longer tuples, annotate stage inputs;
 * every possible chain is checked.
 * @param stages Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A pipeline returning the last stage result, or `undefined` when no
 * stages remain.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. Errors from
 * later stage calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipefns | Full API documentation}
 */
export function pipe<const Stages extends readonly MaybeCallback[]>(
  ...stages: Stages & ValidPipeline<Stages, false>
): Pipeline<Compact<Stages>, false>;

/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * The returned promise adopts the stage result or failure.
 * @param stages Nullish entries followed by the retained callback.
 * @returns A pipeline resolving to the retained stage's awaited result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<F extends UncontextualizedCallback>(...stages: [...Nullish[], F]): Pipeline<[F], true>;
/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * The returned promise adopts the stage result or failure.
 * @param stage Callback receiving the pipeline arguments.
 * @param skipped Trailing nullish entries, which are ignored.
 * @returns A pipeline resolving to the retained stage's awaited result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<F extends UncontextualizedCallback>(stage: F, ...skipped: Nullish[]): Pipeline<[F], true>;
/**
 * Creates a pipeline from one retained stage, skipping adjacent nullish entries.
 * The stage receives the caller's arguments and receiver.
 * The returned promise adopts the stage result or failure.
 * @param skipped Leading nullish entry, which is ignored.
 * @param stage Callback receiving the pipeline arguments.
 * @param trailing Trailing nullish entries, which are ignored.
 * @returns A pipeline resolving to the retained stage's awaited result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<F extends UncontextualizedCallback>(
  skipped: Nullish,
  stage: F,
  ...trailing: Nullish[]
): Pipeline<[F], true>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param stages Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync(...stages: Nullish[]): (...args: unknown[]) => Promise<undefined>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, R0>(
  f0: (this: T0, ...args: Args) => R0
): (this: T0, ...args: Args) => Promise<Awaited<R0>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, R0, R1>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1
): (this: KnownConstraint<T0> & KnownConstraint<T1>, ...args: Args) => Promise<Awaited<R1>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, R0, R1, R2>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2
): (this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2>, ...args: Args) => Promise<Awaited<R2>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f3 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, T3, R0, R1, R2, R3>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2,
  f3: (this: T3, value: Awaited<R2>) => R3
): (
  this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2> & KnownConstraint<T3>,
  ...args: Args
) => Promise<Awaited<R3>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f3 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f4 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, T3, T4, R0, R1, R2, R3, R4>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2,
  f3: (this: T3, value: Awaited<R2>) => R3,
  f4: (this: T4, value: Awaited<R3>) => R4
): (
  this: KnownConstraint<T0> & KnownConstraint<T1> & KnownConstraint<T2> & KnownConstraint<T3> & KnownConstraint<T4>,
  ...args: Args
) => Promise<Awaited<R4>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f3 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f4 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f5 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, T3, T4, T5, R0, R1, R2, R3, R4, R5>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2,
  f3: (this: T3, value: Awaited<R2>) => R3,
  f4: (this: T4, value: Awaited<R3>) => R4,
  f5: (this: T5, value: Awaited<R4>) => R5
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5>,
  ...args: Args
) => Promise<Awaited<R5>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f3 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f4 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f5 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f6 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, T3, T4, T5, T6, R0, R1, R2, R3, R4, R5, R6>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2,
  f3: (this: T3, value: Awaited<R2>) => R3,
  f4: (this: T4, value: Awaited<R3>) => R4,
  f5: (this: T5, value: Awaited<R4>) => R5,
  f6: (this: T6, value: Awaited<R5>) => R6
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5> &
    KnownConstraint<T6>,
  ...args: Args
) => Promise<Awaited<R6>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise.
 * @param f0 First stage, receiving all arguments supplied to the pipeline.
 * @param f1 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f2 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f3 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f4 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f5 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f6 Next stage, receiving exactly one awaited result from the preceding stage.
 * @param f7 Next stage, receiving exactly one awaited result from the preceding stage.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<Args extends unknown[], T0, T1, T2, T3, T4, T5, T6, T7, R0, R1, R2, R3, R4, R5, R6, R7>(
  f0: (this: T0, ...args: Args) => R0,
  f1: (this: T1, value: Awaited<R0>) => R1,
  f2: (this: T2, value: Awaited<R1>) => R2,
  f3: (this: T3, value: Awaited<R2>) => R3,
  f4: (this: T4, value: Awaited<R3>) => R4,
  f5: (this: T5, value: Awaited<R4>) => R5,
  f6: (this: T6, value: Awaited<R5>) => R6,
  f7: (this: T7, value: Awaited<R6>) => R7
): (
  this: KnownConstraint<T0> &
    KnownConstraint<T1> &
    KnownConstraint<T2> &
    KnownConstraint<T3> &
    KnownConstraint<T4> &
    KnownConstraint<T5> &
    KnownConstraint<T6> &
    KnownConstraint<T7>,
  ...args: Args
) => Promise<Awaited<R7>>;
/**
 * Creates a function that runs stages from left to right, awaiting each result.
 * The first stage receives all call arguments; each later stage receives one awaited result.
 * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
 * immediately; calling the pipeline starts the first stage and returns a promise. For nullish
 * gaps and longer tuples, annotate stage inputs; every possible chain is checked.
 * @param stages Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A pipeline whose promise resolves to the last awaited result, or
 * `undefined` when no stages remain. A throw or rejection stops later stages.
 * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
 * the pipeline rejects with the original stage failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
 */
export function pipeAsync<const Stages extends readonly MaybeCallback[]>(
  ...stages: Stages & ValidPipeline<Stages, true>
): Pipeline<Compact<Stages>, true>;

export namespace pipe {
  /**
   * Creates a function that runs stages from left to right, awaiting each result.
   * Alias of `pipeAsync`; the same function object.
   * The first stage receives all call arguments; each later stage receives one awaited result.
   * Stages share the caller's `this`. Nullish stages are skipped. Construction validates
   * immediately; calling the pipeline starts the first stage and returns a promise.
   * @param stages Functions in call order; `null` and
   * `undefined` entries are skipped.
   * @returns A pipeline whose promise resolves to the last awaited result, or
   * `undefined` when no stages remain. A throw or rejection stops later stages.
   * @throws {TypeError} If a stage is neither a function, `null` nor `undefined`. When called,
   * the pipeline rejects with the original stage failure.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#pipeasyncfns | Full API documentation}
   */
  const async: typeof pipeAsync;
}

/**
 * Invokes a callback synchronously and returns its result or the exact value it throws.
 * The callback itself is its receiver; bind it to supply another `this`. Returned and thrown
 * values are indistinguishable. Promises are returned unchanged, and later rejections are not
 * caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns The callback result or exact thrown value, including `null` or `undefined`.
 * @throws {TypeError} If `fn` is not a function; validation happens outside the catch.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptfn-args | Full API documentation}
 */
export function attempt<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): unknown;
/**
 * Invokes a callback synchronously and returns its result or the exact value it throws.
 * The callback itself is its receiver; bind it to supply another `this`. Returned and thrown
 * values are indistinguishable. Promises are returned unchanged, and later rejections are not
 * caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns The callback result or exact thrown value, including `null` or `undefined`.
 * @throws {TypeError} If `fn` is not a function; validation happens outside the catch.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptfn-args | Full API documentation}
 */
export function attempt<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  ...args: Args
): unknown;
/**
 * Invokes a callback synchronously and returns its result or the exact value it throws.
 * The callback itself is its receiver; bind it to supply another `this`. Returned and thrown
 * values are indistinguishable. Promises are returned unchanged, and later rejections are not
 * caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns The callback result or exact thrown value, including `null` or `undefined`.
 * @throws {TypeError} If `fn` is not a function; validation happens outside the catch.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptfn-args | Full API documentation}
 */
export function attempt<F extends UncontextualizedCallback>(
  fn: F & SelfReceiver<F>,
  ...args: NoInfer<CapturedCall<F>['args']>
): unknown;
export namespace attempt {
  /**
   * Invokes a callback synchronously and reports success or failure in a result object.
   * Alias of `attemptResult`; the same function object.
   * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
   * receiver. Promises are successful values without awaiting; later rejections are not caught.
   * @param fn Required callback.
   * @param args Arguments passed to the callback.
   * @returns A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
   * }` with the exact thrown value.
   * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
   * a failure result.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
   */
  const result: typeof attemptResult;
  /**
   * Invokes a callback, awaits its result and reports success or failure in a result object.
   * Alias of `attemptResultAsync`; the same function object.
   * The callback itself is its receiver. Callback throws, promise rejections and failures while
   * awaiting thenables are captured without replacing the original failure. Invalid callbacks
   * reject instead of producing a failure result.
   * Rejects with `TypeError` if `fn` is not a function.
   * @param fn Required callback.
   * @param args Arguments passed to the callback.
   * @returns A promise resolving to a fresh `{ ok: true, value }` object with
   * the awaited value, or `{ ok: false, error }` with the exact failure.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
   */
  const resultAsync: typeof attemptResultAsync;
}
/**
 * Invokes a callback synchronously and reports success or failure in a result object.
 * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
 * receiver. Promises are successful values without awaiting; later rejections are not caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
 * }` with the exact thrown value.
 * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
 * a failure result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
 */
export function attemptResult<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): Result<Value>;
/**
 * Invokes a callback synchronously and reports success or failure in a result object.
 * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
 * receiver. Promises are successful values without awaiting; later rejections are not caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
 * }` with the exact thrown value.
 * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
 * a failure result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
 */
export function attemptResult<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  ...args: Args
): Result<Value>;
/**
 * Invokes a callback synchronously and reports success or failure in a result object.
 * Check `ok` to distinguish a returned value from a thrown value. The callback itself is its
 * receiver. Promises are successful values without awaiting; later rejections are not caught.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A fresh `{ ok: true, value }` object on success, or `{ ok: false, error
 * }` with the exact thrown value.
 * @throws {TypeError} If `fn` is not a function; invalid callbacks throw instead of producing
 * a failure result.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultfn-args | Full API documentation}
 */
export function attemptResult<F extends UncontextualizedCallback>(
  fn: F & SelfReceiver<F>,
  ...args: NoInfer<CapturedCall<F>['args']>
): Result<ReturnType<F>>;
export namespace attemptResult {
  /**
   * Invokes a callback, awaits its result and reports success or failure in a result object.
   * Alias of `attemptResultAsync`; the same function object.
   * The callback itself is its receiver. Callback throws, promise rejections and failures while
   * awaiting thenables are captured without replacing the original failure. Invalid callbacks
   * reject instead of producing a failure result.
   * Rejects with `TypeError` if `fn` is not a function.
   * @param fn Required callback.
   * @param args Arguments passed to the callback.
   * @returns A promise resolving to a fresh `{ ok: true, value }` object with
   * the awaited value, or `{ ok: false, error }` with the exact failure.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
   */
  const async: typeof attemptResultAsync;
}
/**
 * Invokes a callback, awaits its result and reports success or failure in a result object.
 * The callback itself is its receiver. Callback throws, promise rejections and failures while
 * awaiting thenables are captured without replacing the original failure. Invalid callbacks
 * reject instead of producing a failure result.
 * Rejects with `TypeError` if `fn` is not a function.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh `{ ok: true, value }` object with
 * the awaited value, or `{ ok: false, error }` with the exact failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
 */
export function attemptResultAsync<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): Promise<Result<Awaited<Value>>>;
/**
 * Invokes a callback, awaits its result and reports success or failure in a result object.
 * The callback itself is its receiver. Callback throws, promise rejections and failures while
 * awaiting thenables are captured without replacing the original failure. Invalid callbacks
 * reject instead of producing a failure result.
 * Rejects with `TypeError` if `fn` is not a function.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh `{ ok: true, value }` object with
 * the awaited value, or `{ ok: false, error }` with the exact failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
 */
export function attemptResultAsync<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  ...args: Args
): Promise<Result<Awaited<Value>>>;
/**
 * Invokes a callback, awaits its result and reports success or failure in a result object.
 * The callback itself is its receiver. Callback throws, promise rejections and failures while
 * awaiting thenables are captured without replacing the original failure. Invalid callbacks
 * reject instead of producing a failure result.
 * Rejects with `TypeError` if `fn` is not a function.
 * @param fn Required callback.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh `{ ok: true, value }` object with
 * the awaited value, or `{ ok: false, error }` with the exact failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#attemptresultasyncfn-args | Full API documentation}
 */
export function attemptResultAsync<F extends UncontextualizedCallback>(
  fn: F & SelfReceiver<F>,
  ...args: NoInfer<CapturedCall<F>['args']>
): Promise<Result<Awaited<ReturnType<F>>>>;

/**
 * A function that observes one input and returns the exact input type and value.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export type Tap<This, Input> = undefined extends Input
  ? {
      (this: This): undefined;
      <Value extends Input>(this: This, value: Value): Value;
    }
  : <Value extends Input>(this: This, value: Value) => Value;
/**
 * An observer function whose promise resolves to the awaited input value after observation completes.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export type AsyncTap<This, Input> = undefined extends Input
  ? {
      (this: This): Promise<undefined>;
      <Value extends Input>(this: This, value: Value): Promise<Awaited<Value>>;
    }
  : <Value extends Input>(this: This, value: Value) => Promise<Awaited<Value>>;
/**
 * Creates a function that calls an observer with one value and returns that value unchanged.
 * The observer receives the caller's `this`. Its return value is ignored without awaiting.
 * Object identity is preserved, and mutations made by the observer remain visible.
 * @param observer Observer receiving exactly one input value.
 * @returns A wrapper returning the exact input value or object reference after the
 * observer returns.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapobserver | Full API documentation}
 */
export function tap<This, Input>(observer: (this: This, value: Input) => unknown): Tap<This, Input>;
export namespace tap {
  /**
   * Creates a function that awaits an observer before returning its input value.
   * Alias of `tapAsync`; the same function object.
   * The observer receives exactly one input and the caller's `this`. A promise input reaches
   * the observer unchanged, but the returned promise resolves to its awaited value.
   * @param observer Synchronous or asynchronous observer receiving one input.
   * @returns An async wrapper resolving to the input after the observer succeeds;
   * promise inputs are unwrapped. Observer failures reject the wrapper promise.
   * @throws {TypeError} If `observer` is not a function. Later observer throws or rejections
   * reject the wrapper promise.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapasyncobserver | Full API documentation}
   */
  const async: typeof tapAsync;
}
/**
 * Creates a function that awaits an observer before returning its input value.
 * The observer receives exactly one input and the caller's `this`. A promise input reaches
 * the observer unchanged, but the returned promise resolves to its awaited value.
 * @param observer Synchronous or asynchronous observer receiving one input.
 * @returns An async wrapper resolving to the input after the observer succeeds;
 * promise inputs are unwrapped. Observer failures reject the wrapper promise.
 * @throws {TypeError} If `observer` is not a function. Later observer throws or rejections
 * reject the wrapper promise.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#tapasyncobserver | Full API documentation}
 */
export function tapAsync<This, Input>(observer: (this: This, value: Input) => unknown): AsyncTap<This, Input>;
/**
 * Creates a promise that resolves after a cancellable pause.
 * The host timer may run late. An already-aborted signal rejects without scheduling a timer.
 * Later cancellation clears the timer; listener cleanup runs on success, cancellation or
 * scheduling failure.
 * Rejects with `TypeError` for invalid argument types or `RangeError` for unsupported
 * durations. Signal and host-timer errors also reject the promise.
 * @param [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param [options] Optional non-null, non-array options object.
 * @returns A promise resolving to `undefined` after the timer, or rejecting
 * with the exact `signal.reason` when aborted.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#sleepmilliseconds-options | Full API documentation}
 */
export function sleep(milliseconds?: number, options?: SleepOptions): Promise<void>;
// Capture a stable outcome type: generic relationships cannot be re-inferred per call
// because every later invocation returns the FIRST result, regardless of its arguments.
type CapturedCall<F> = Intersection<
  F extends AnyFunction
    ? {
        receiver: KnownConstraint<ThisParameterType<F>>;
        args: Parameters<F>;
      }
    : never
> & { receiver: unknown; args: unknown[] };
/**
 * Creates a function that invokes its callback at most once and caches the first outcome.
 * The first call supplies the arguments and `this`; later calls ignore their inputs. Exact
 * returned values, promise identity and thrown values are cached. Failures are not retried,
 * and creating the wrapper does not invoke the callback.
 * @param fn Required callback.
 * @returns A wrapper reusing the first returned value or promise, or rethrowing
 * the first thrown value unchanged.
 * @throws {TypeError} If `fn` is not a function.
 * @throws {Error} If the wrapper is called recursively before its first callback returns. An
 * uncaught recursive-call error becomes the cached failure.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#oncefn | Full API documentation}
 */
export function once<F extends UncontextualizedCallback>(
  fn: F
): (this: CapturedCall<F>['receiver'], ...args: CapturedCall<F>['args']) => ReturnType<F>;

/**
 * Invokes a callback a specified number of times synchronously and collects its results.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. Promises are collected without awaiting. Large counts
 * still require practical memory limits.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A fresh array of callback results in invocation order; an empty array for
 * a zero or nullish count.
 * @throws {TypeError} If `fn` is not a function or `count` is non-nullish and not a number.
 * @throws {RangeError} If `count` is not an integer in the supported range. Callback errors
 * stop further calls and propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatfn-count-args | Full API documentation}
 */
export function repeat<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  count?: number | null,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): Value[];
/**
 * Invokes a callback a specified number of times synchronously and collects its results.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. Promises are collected without awaiting. Large counts
 * still require practical memory limits.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A fresh array of callback results in invocation order; an empty array for
 * a zero or nullish count.
 * @throws {TypeError} If `fn` is not a function or `count` is non-nullish and not a number.
 * @throws {RangeError} If `count` is not an integer in the supported range. Callback errors
 * stop further calls and propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatfn-count-args | Full API documentation}
 */
export function repeat<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  count?: number | null,
  ...args: Args
): Value[];
/**
 * Invokes a callback a specified number of times synchronously and collects its results.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. Promises are collected without awaiting. Large counts
 * still require practical memory limits.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A fresh array of callback results in invocation order; an empty array for
 * a zero or nullish count.
 * @throws {TypeError} If `fn` is not a function or `count` is non-nullish and not a number.
 * @throws {RangeError} If `count` is not an integer in the supported range. Callback errors
 * stop further calls and propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatfn-count-args | Full API documentation}
 */
export function repeat<F extends UncontextualizedCallback>(
  fn: F & SelfReceiver<F>,
  count?: number | null,
  ...args: NoInfer<CapturedCall<F>['args']>
): ReturnType<F>[];
/**
 * Schedules a callback through the host's `setTimeout` and returns its timer handle.
 * Duration coercion, scheduling and the callback receiver follow the host timer. Use
 * `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback
 * synchronously.
 * @param fn Required callback.
 * @param [milliseconds] Delay passed unchanged to the host timer; host
 * defaults and coercion apply.
 * @param args Arguments passed to the callback.
 * @returns The native timer handle: a browser number or a Node.js `Timeout`
 * object.
 * @throws {TypeError} If `fn` is not a function. Scheduling errors propagate; later callback
 * errors are reported by the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#delayfn-milliseconds-args | Full API documentation}
 */
export function delay<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  milliseconds?: number | null,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): TimerHandle;
/**
 * Schedules a callback through the host's `setTimeout` and returns its timer handle.
 * Duration coercion, scheduling and the callback receiver follow the host timer. Use
 * `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback
 * synchronously.
 * @param fn Required callback.
 * @param [milliseconds] Delay passed unchanged to the host timer; host
 * defaults and coercion apply.
 * @param args Arguments passed to the callback.
 * @returns The native timer handle: a browser number or a Node.js `Timeout`
 * object.
 * @throws {TypeError} If `fn` is not a function. Scheduling errors propagate; later callback
 * errors are reported by the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#delayfn-milliseconds-args | Full API documentation}
 */
export function delay<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  milliseconds?: number | null,
  ...args: Args
): TimerHandle;
/**
 * Schedules a callback through the host's `setTimeout` and returns its timer handle.
 * Duration coercion, scheduling and the callback receiver follow the host timer. Use
 * `clearTimeout` to cancel the handle. Creating the timeout does not invoke the callback
 * synchronously.
 * @param fn Required callback.
 * @param [milliseconds] Delay passed unchanged to the host timer; host
 * defaults and coercion apply.
 * @param args Arguments passed to the callback.
 * @returns The native timer handle: a browser number or a Node.js `Timeout`
 * object.
 * @throws {TypeError} If `fn` is not a function. Scheduling errors propagate; later callback
 * errors are reported by the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#delayfn-milliseconds-args | Full API documentation}
 */
export function delay<F extends UncontextualizedCallback>(
  fn: F,
  milliseconds?: number | null,
  ...args: NoInfer<CapturedCall<F>['args']>
): TimerHandle;
// Only homogeneous, prefix/suffix-free variadics accept arbitrary array-like inputs.
// Tuple types preserve mandatory positions; a union of their element types cannot.
// Strings satisfy ArrayLike structurally, but native apply requires an object.
type SpreadInput<Args extends unknown[]> =
  | Readonly<Args>
  | (number extends Args['length'] ? (Args[number][] extends Args ? ArrayLike<Args[number]> & object : never) : never);
/**
 * Creates a function that passes an array-like input to its callback as individual arguments.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Arrays, typed arrays and array-like objects work; `null` or `undefined` supplies
 * no arguments. Iterability alone does not expand a collection.
 * @param fn Required callback.
 * @returns A wrapper returning the callback result after expanding its argument
 * list.
 * @throws {TypeError} If `fn` is not a function, or a later argument list is primitive and
 * non-nullish. Argument-list getter and callback errors propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#spreadfn | Full API documentation}
 */
export function spread<This, Args extends unknown[], Value>(
  fn: (this: This, ...args: Args) => Value
): (this: This, ...input: [] extends Args ? [args?: SpreadInput<Args> | null] : [args: SpreadInput<Args>]) => Value;

// An unconstrained inferred type must not erase another callback's concrete requirement.
type KnownConstraint<T> = 0 extends 1 & T ? unknown : T;

// Predicates may ignore surplus inputs. Opening fixed tuples before intersecting
// avoids the impossible length intersection of e.g. [] and [user: User].
// Explicit tuple unions describe complete call alternatives; opening the empty
// alternative would incorrectly permit arbitrary inputs to that callback.
type IsUnion<T, Whole = T> = T extends unknown ? ([Whole] extends [T] ? false : true) : never;
type OpenArguments<A extends unknown[]> =
  true extends IsUnion<A> ? A : number extends A['length'] ? A : [...A, ...unknown[]];
// Intersect records rather than compacted tuple alternatives: an optional
// predicate may execute, so its input and receiver requirements must not vanish.
// The record keeps an unconstrained receiver from swallowing another receiver.
type PredicateRequirement<F> = F extends AnyFunction
  ? {
      receiver: KnownConstraint<ThisParameterType<F>>;
      args: OpenArguments<Parameters<F>>;
    }
  : never;
type PredicateRequirements<S extends readonly MaybeFunction[]> = Intersection<PredicateRequirement<S[number]>> & {
  receiver: unknown;
  args: unknown[];
};
// Contextual overloads infer This/Args from the whole list while capturing each exact
// callback in S. NoInfer in S's constraint prevents capture from changing that context.
type CombinedPredicate<S extends readonly MaybeFunction[], Async extends boolean = false> = (
  this: PredicateRequirements<S>['receiver'],
  ...args: PredicateRequirements<S>['args']
) => Async extends true ? Promise<boolean> : boolean;

/**
 * Creates a predicate that determines whether all supplied predicates return truthy values.
 * Stops at the first falsy result. The returned predicate forwards all call arguments and the
 * caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are
 * skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are truthy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andfns | Full API documentation}
 */
export function and<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether all supplied predicates return truthy values.
 * Stops at the first falsy result. The returned predicate forwards all call arguments and the
 * caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are
 * skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are truthy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andfns | Full API documentation}
 */
export function and<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => boolean;
/**
 * Creates a predicate that determines whether all supplied predicates return truthy values.
 * Stops at the first falsy result. The returned predicate forwards all call arguments and the
 * caller's `this`. Promise results are truthy and are never awaited. Nullish predicates are
 * skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are truthy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andfns | Full API documentation}
 */
export function and<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether any supplied predicate returns a truthy value.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if any result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orfns | Full API documentation}
 */
export function or<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether any supplied predicate returns a truthy value.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if any result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orfns | Full API documentation}
 */
export function or<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => boolean;
/**
 * Creates a predicate that determines whether any supplied predicate returns a truthy value.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if any result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orfns | Full API documentation}
 */
export function or<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether exactly one supplied predicate returns a truthy
 * value.
 * Stops at the second truthy result. Three truthy results still produce `false`; this is not
 * odd-parity XOR. The returned predicate forwards all call arguments and the caller's `this`.
 * Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty
 * list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if exactly one result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorfns | Full API documentation}
 */
export function xor<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether exactly one supplied predicate returns a truthy
 * value.
 * Stops at the second truthy result. Three truthy results still produce `false`; this is not
 * odd-parity XOR. The returned predicate forwards all call arguments and the caller's `this`.
 * Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty
 * list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if exactly one result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorfns | Full API documentation}
 */
export function xor<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => boolean;
/**
 * Creates a predicate that determines whether exactly one supplied predicate returns a truthy
 * value.
 * Stops at the second truthy result. Three truthy results still produce `false`; this is not
 * odd-parity XOR. The returned predicate forwards all call arguments and the caller's `this`.
 * Promise results are truthy and are never awaited. Nullish predicates are skipped; an empty
 * list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if exactly one result is truthy; otherwise
 * `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorfns | Full API documentation}
 */
export function xor<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether all supplied predicates return falsy values.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are falsy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norfns | Full API documentation}
 */
export function nor<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S>;
/**
 * Creates a predicate that determines whether all supplied predicates return falsy values.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are falsy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norfns | Full API documentation}
 */
export function nor<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => boolean;
/**
 * Creates a predicate that determines whether all supplied predicates return falsy values.
 * Stops at the first truthy result. The returned predicate forwards all call arguments and
 * the caller's `this`. Promise results are truthy and are never awaited. Nullish predicates
 * are skipped; an empty list returns `false` when called.
 * @param predicates Functions in call order; `null` and
 * `undefined` entries are skipped.
 * @returns A predicate returning `true` if at least one predicate remains and all
 * results are falsy; otherwise `false`.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`. All entries
 * are validated before evaluation; later callback errors propagate.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norfns | Full API documentation}
 */
export function nor<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S>;
/**
 * Creates a predicate that negates its callback's truthiness.
 * Unlike the multi-predicate helpers, a missing or nullish callback is invalid. The returned
 * predicate forwards all call arguments and the caller's `this`. Promise results are truthy
 * and are never awaited.
 * @param predicate Required predicate; missing or nullish values are invalid.
 * @returns A predicate returning `true` if the callback result is falsy; otherwise
 * `false`.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#notfn | Full API documentation}
 */
export function not<This, Args extends unknown[]>(
  predicate: (this: This, ...args: Args) => unknown
): (this: This, ...args: Args) => boolean;

/**
 * Creates a predicate that awaits its callback and negates the result's truthiness.
 * The returned predicate forwards all arguments and the caller's `this`. Construction
 * validates the required callback immediately; later throws and rejections reject the
 * returned promise unchanged. This helper does not provide type-guard narrowing.
 * @param predicate Required predicate returning a synchronous value, promise or thenable.
 * @returns A predicate resolving to `true` for a falsy awaited result, otherwise `false`.
 * @throws {TypeError} If the required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#notasyncfn | Full API documentation}
 */
export function notAsync<F extends UncontextualizedCallback>(predicate: F): CombinedPredicate<[F], true>;
export namespace not {
  /**
   * Creates a predicate that awaits its callback and negates the result's truthiness.
   * Alias of `notAsync`; the same function object. All arguments and the caller's `this`
   * reach the callback. Construction validates immediately; later throws and rejections
   * reject the returned promise unchanged.
   * @param predicate Required predicate returning a synchronous value, promise or thenable.
   * @returns A predicate resolving to `true` for a falsy awaited result, otherwise `false`.
   * @throws {TypeError} If the required callback is not a function.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#notasyncfn | Full API documentation}
   */
  const async: typeof notAsync;
}

/**
 * Creates a predicate that awaits results sequentially and stops at the first falsy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and all results
 * are truthy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
 */
export function andAsync<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S, true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first falsy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and all results
 * are truthy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
 */
export function andAsync<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => Promise<boolean>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first falsy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and all results
 * are truthy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
 */
export function andAsync<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S, true>;
export namespace and {
  /**
   * Creates a predicate that awaits results sequentially and stops at the first falsy result.
   * Alias of `andAsync`; the same function object. All arguments and the caller's `this`
   * reach each callback. Nullish entries are skipped; an empty list resolves to `false`.
   * Construction validates all entries immediately. A later throw or rejection rejects
   * the promise unchanged and skips remaining callbacks.
   * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
   * @returns A predicate resolving to `true` if at least one predicate remains and all results
   * are truthy; otherwise `false`.
   * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#andasyncfns | Full API documentation}
   */
  const async: typeof andAsync;
}

/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if any result is truthy, otherwise `false`.
 * No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orasyncfns | Full API documentation}
 */
export function orAsync<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S, true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if any result is truthy, otherwise `false`.
 * No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orasyncfns | Full API documentation}
 */
export function orAsync<This, Args extends unknown[]>(
  ...predicates: (((this: This, ...args: Args) => unknown) | Nullish)[]
): (this: This, ...args: Args) => Promise<boolean>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * The returned predicate forwards all arguments and the caller's `this`. Nullish entries
 * are skipped; an empty list resolves to `false`. Construction validates all entries
 * immediately. A later throw or rejection rejects the promise and skips remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if any result is truthy, otherwise `false`.
 * No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orasyncfns | Full API documentation}
 */
export function orAsync<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S, true>;
export namespace or {
  /**
   * Creates a predicate that awaits results sequentially and stops at the first truthy result.
   * Alias of `orAsync`; the same function object. All arguments and the caller's `this`
   * reach each callback. Nullish entries are skipped; an empty list resolves to `false`.
   * Construction validates all entries immediately. A later throw or rejection rejects
   * the promise unchanged and skips remaining callbacks.
   * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
   * @returns A predicate resolving to `true` if any result is truthy, otherwise `false`.
   * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#orasyncfns | Full API documentation}
   */
  const async: typeof orAsync;
}

/**
 * Creates a function that prepends saved arguments to each call without binding its receiver.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Saved values are retained by reference. There are no placeholders or constructor
 * adaptations.
 * @param fn Required callback.
 * @param args Arguments saved before the arguments supplied on each later call.
 * @returns A wrapper returning the callback result after prepending the saved
 * arguments.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#partialfn-args | Full API documentation}
 */
export function partial<This, Head extends unknown[], Tail extends unknown[], Value>(
  fn: (this: This, ...args: [...Head, ...Tail]) => Value,
  ...args: Head
): (this: This, ...args: Tail) => Value;
export namespace partial {
  /**
   * Creates a function that appends saved arguments to each call without binding its receiver.
   * Alias of `partialRight`; the same function object.
   * The returned function forwards its caller's `this` to the callback and returns promises
   * unchanged. Saved values are retained by reference. Omitted inputs are not padded; supply
   * optional prefix positions explicitly when needed to keep saved arguments in place.
   * @param fn Required callback.
   * @param args Arguments saved after the arguments supplied on each later call.
   * @returns A wrapper returning the callback result after appending the saved
   * arguments.
   * @throws {TypeError} If a required callback is not a function. Errors from later callback
   * calls propagate unchanged.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#partialrightfn-args | Full API documentation}
   */
  const right: typeof partialRight;
}
type DropRight<A extends unknown[], B extends unknown[]> = B extends []
  ? A
  : B extends [unknown, ...infer Rest]
    ? A extends [...infer Init, unknown?]
      ? DropRight<Init, Rest>
      : never
    : never;
// Appended arguments do not pad omitted optional slots. Make those slots explicit.
type ExplicitSlots<A extends unknown[]> = '0' extends keyof A
  ? A extends [unknown?, ...infer T]
    ? [A[0], ...ExplicitSlots<T>]
    : never
  : A;
// Consume BOTH required and optional fixed slots before inspecting the true rest.
// Ambiguous non-leading rest tuples require an explicitly typed callback adapter.
type RestItem<A extends unknown[]> = '0' extends keyof A
  ? A extends [unknown?, ...infer T]
    ? RestItem<T>
    : never
  : A[number][] extends A
    ? A[number]
    : never;
type RightInputs<A extends unknown[], B extends unknown[]> = B extends []
  ? A
  : number extends A['length']
    ? ExplicitSlots<A>
    : ExplicitSlots<DropRight<A, B>>;
// Evaluate each possible callback independently, then require EVERY result to
// be true. Returning unknown | never would silently discard invalid alternatives.
type FitsRight<F extends AnyFunction, B extends unknown[]> = B extends []
  ? true
  : number extends Parameters<F>['length']
    ? B extends RestItem<Parameters<F>>[]
      ? AcceptsArguments<F, [...RightInputs<Parameters<F>, B>, ...B]> extends true
        ? true
        : false
      : false
    : [RightInputs<Parameters<F>, B>] extends [never]
      ? false
      : AcceptsArguments<F, [...RightInputs<Parameters<F>, B>, ...B]> extends true
        ? true
        : false;
type ValidRight<F extends AnyFunction, B extends unknown[]> = [F extends unknown ? FitsRight<F, B> : never] extends [
  true
]
  ? unknown
  : never;
// Calls must satisfy every callback and saved-tuple alternative. A shorter saved
// tuple must not inherit the fewer required inputs of a longer alternative.
type RightCall<F, B extends unknown[]> = Intersection<
  F extends AnyFunction
    ? B extends unknown
      ? {
          receiver: KnownConstraint<ThisParameterType<F>>;
          args: RightInputs<Parameters<F>, B>;
        }
      : never
    : never
> & { receiver: unknown; args: unknown[] };
/**
 * Creates a function that appends saved arguments to each call without binding its receiver.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. Saved values are retained by reference. Omitted inputs are not padded; supply
 * optional prefix positions explicitly when needed to keep saved arguments in place.
 * @param fn Required callback.
 * @param args Arguments saved after the arguments supplied on each later call.
 * @returns A wrapper returning the callback result after appending the saved
 * arguments.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#partialrightfn-args | Full API documentation}
 */
export function partialRight<F extends UncontextualizedCallback, Bound extends unknown[]>(
  fn: F,
  ...args: Bound & ValidRight<F, Bound>
): (this: RightCall<F, Bound>['receiver'], ...args: RightCall<F, Bound>['args']) => ReturnType<F>;
/**
 * Creates a function that forwards exactly one argument to its callback.
 * The returned function forwards its caller's `this` to the callback and returns promises
 * unchanged. An omitted input becomes one explicit `undefined`; additional arguments are
 * ignored.
 * @param fn Required callback.
 * @returns A wrapper returning the callback result after passing exactly one
 * argument.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#unaryfn | Full API documentation}
 */
export function unary<This, Input, Value>(
  fn: (this: This, value: Input) => Value
): (this: This, ...args: undefined extends Input ? [value?: Input] : [value: Input]) => Value;
/**
 * Creates a function that transforms one value when a predicate is truthy and otherwise
 * returns it unchanged.
 * When called, the wrapper evaluates the predicate once. Both callbacks receive exactly one
 * input and the caller's `this`. Predicate promises are truthy without awaiting; a transform
 * result or promise is returned unchanged.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param transform Transformation called only when the predicate result is truthy.
 * @returns A wrapper returning the transform result for a truthy predicate result;
 * otherwise the exact input value or object reference.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenpredicate-transform | Full API documentation}
 */
export function when<P, T, Input, Narrow extends Input, Output>(
  predicate: (this: P, value: Input) => value is Narrow,
  transform: (this: T, value: Narrow) => Output
): (this: KnownConstraint<P> & KnownConstraint<T>, value: Input) => Input | Output;
/**
 * Creates a function that transforms one value when a predicate is truthy and otherwise
 * returns it unchanged.
 * When called, the wrapper evaluates the predicate once. Both callbacks receive exactly one
 * input and the caller's `this`. Predicate promises are truthy without awaiting; a transform
 * result or promise is returned unchanged.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param transform Transformation called only when the predicate result is truthy.
 * @returns A wrapper returning the transform result for a truthy predicate result;
 * otherwise the exact input value or object reference.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenpredicate-transform | Full API documentation}
 */
export function when<P, T, Input, Output>(
  predicate: (this: P, value: Input) => unknown,
  transform: (this: T, value: Input) => Output
): (this: KnownConstraint<P> & KnownConstraint<T>, value: Input) => Input | Output;
/**
 * Creates a function that evaluates a predicate once and calls the matching branch.
 * All call arguments and the caller's `this` reach the predicate and selected branch. The
 * other branch is not called. Predicate promises are truthy without awaiting; the selected
 * branch result is returned unchanged.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param onTrue Branch called for a truthy predicate result.
 * @param onFalse Branch called for a falsy predicate result.
 * @returns A wrapper returning the `onTrue` result for a truthy predicate result,
 * or the `onFalse` result otherwise.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelsepredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElse<Input, Narrow extends Input, P, T, F, Yes, No>(
  predicate: (this: P, value: Input) => value is Narrow,
  onTrue: (this: T, value: NoInfer<Narrow>) => Yes,
  onFalse: (this: F, value: Exclude<NoInfer<Input>, Narrow>) => No
): (this: KnownConstraint<P> & KnownConstraint<T> & KnownConstraint<F>, value: Input) => Yes | No;
/**
 * Creates a function that evaluates a predicate once and calls the matching branch.
 * All call arguments and the caller's `this` reach the predicate and selected branch. The
 * other branch is not called. Predicate promises are truthy without awaiting; the selected
 * branch result is returned unchanged.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param onTrue Branch called for a truthy predicate result.
 * @param onFalse Branch called for a falsy predicate result.
 * @returns A wrapper returning the `onTrue` result for a truthy predicate result,
 * or the `onFalse` result otherwise.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelsepredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElse<Args extends unknown[], P, T, F, Yes, No>(
  predicate: (this: P, ...args: Args) => unknown,
  onTrue: (this: T, ...args: Args) => Yes,
  onFalse: (this: F, ...args: Args) => No
): (this: KnownConstraint<P> & KnownConstraint<T> & KnownConstraint<F>, ...args: Args) => Yes | No;
/**
 * Creates a function that evaluates a predicate once and calls the matching branch.
 * All call arguments and the caller's `this` reach the predicate and selected branch. The
 * other branch is not called. Predicate promises are truthy without awaiting; the selected
 * branch result is returned unchanged. This overload supports callbacks that ignore some
 * inputs.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param onTrue Branch called for a truthy predicate result.
 * @param onFalse Branch called for a falsy predicate result.
 * @returns A wrapper returning the `onTrue` result for a truthy predicate result,
 * or the `onFalse` result otherwise.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelsepredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElse<Args extends unknown[], P, T, F, Yes, No>(
  predicate: (this: P, ...args: NoInfer<Args>) => unknown,
  onTrue: (this: T, ...args: Args) => Yes,
  onFalse: (this: F, ...args: NoInfer<Args>) => No
): (this: KnownConstraint<P> & KnownConstraint<T> & KnownConstraint<F>, ...args: Args) => Yes | No;
/**
 * Creates a function that evaluates a predicate once and calls the matching branch.
 * All call arguments and the caller's `this` reach the predicate and selected branch. The
 * other branch is not called. Predicate promises are truthy without awaiting; the selected
 * branch result is returned unchanged.
 * @param predicate Synchronous condition; a returned promise is truthy and is not
 * awaited.
 * @param onTrue Branch called for a truthy predicate result.
 * @param onFalse Branch called for a falsy predicate result.
 * @returns A wrapper returning the `onTrue` result for a truthy predicate result,
 * or the `onFalse` result otherwise.
 * @throws {TypeError} If a required callback is not a function. Errors from later callback
 * calls propagate unchanged.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelsepredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElse<Args extends unknown[], P, T, F, Yes, No>(
  predicate: (this: P, ...args: NoInfer<Args>) => unknown,
  onTrue: (this: T, ...args: NoInfer<Args>) => Yes,
  onFalse: (this: F, ...args: Args) => No
): (this: KnownConstraint<P> & KnownConstraint<T> & KnownConstraint<F>, ...args: Args) => Yes | No;
/**
 * Invokes a callback a specified number of times sequentially, awaiting each result.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is
 * not undone.
 * Rejects with `TypeError` for an invalid callback or non-nullish non-number count,
 * `RangeError` for an unsupported count, or the original callback failure.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh array of awaited results in
 * invocation order; an empty array for a zero or nullish count.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatasyncfn-count-args | Full API documentation}
 */
export function repeatAsync<Args extends unknown[], Value, F extends object>(
  fn: F & ContextualCallback<NoInfer<Args>, Value>,
  count?: number | null,
  ...args: Args & NoInfer<ContextualArguments<F>> & DefaultableCall<F>
): Promise<Awaited<Value>[]>;
/**
 * Invokes a callback a specified number of times sequentially, awaiting each result.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is
 * not undone.
 * Rejects with `TypeError` for an invalid callback or non-nullish non-number count,
 * `RangeError` for an unsupported count, or the original callback failure.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh array of awaited results in
 * invocation order; an empty array for a zero or nullish count.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatasyncfn-count-args | Full API documentation}
 */
export function repeatAsync<Args extends unknown[], Value>(
  fn: (this: void, ...args: NoInfer<Args>) => Value,
  count?: number | null,
  ...args: Args
): Promise<Awaited<Value>[]>;
/**
 * Invokes a callback a specified number of times sequentially, awaiting each result.
 * Each call receives the same arguments with the callback itself as its receiver; no index is
 * added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is
 * not undone.
 * Rejects with `TypeError` for an invalid callback or non-nullish non-number count,
 * `RangeError` for an unsupported count, or the original callback failure.
 * @param fn Required callback.
 * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
 * `undefined` means zero.
 * @param args Arguments passed to the callback.
 * @returns A promise resolving to a fresh array of awaited results in
 * invocation order; an empty array for a zero or nullish count.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatasyncfn-count-args | Full API documentation}
 */
export function repeatAsync<F extends UncontextualizedCallback>(
  fn: F & SelfReceiver<F>,
  count?: number | null,
  ...args: NoInfer<CapturedCall<F>['args']>
): Promise<Awaited<ReturnType<F>>[]>;
export namespace repeat {
  /**
   * Invokes a callback a specified number of times sequentially, awaiting each result.
   * Alias of `repeatAsync`; the same function object.
   * Each call receives the same arguments with the callback itself as its receiver; no index is
   * added. Nullish counts mean zero. A throw or rejection stops later calls; completed work is
   * not undone.
   * Rejects with `TypeError` for an invalid callback or non-nullish non-number count,
   * `RangeError` for an unsupported count, or the original callback failure.
   * @param fn Required callback.
   * @param [count=0] Integer from 0 through 4294967295; omitted, `null` or
   * `undefined` means zero.
   * @param args Arguments passed to the callback.
   * @returns A promise resolving to a fresh array of awaited results in
   * invocation order; an empty array for a zero or nullish count.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#repeatasyncfn-count-args | Full API documentation}
   */
  const async: typeof repeatAsync;
}

/**
 * Controls whether a throttled callback runs at the start and end of an interval. Both edges default to `true`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export interface ThrottleOptions {
  /** Whether to invoke on the leading edge. Defaults to `true` for throttle and `false` for debounce. */
  leading?: boolean | undefined;
  /** Whether to invoke pending work on the trailing edge. Defaults to `true`. */
  trailing?: boolean | undefined;
}
/**
 * Controls leading and trailing calls and maximum postponement. Leading defaults to `false`; trailing defaults to `true`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export interface DebounceOptions extends ThrottleOptions {
  /** Optional maximum postponement in milliseconds, from the ordinary wait through 2147483647. */
  maxWait?: number | undefined;
}
/**
 * A callback wrapper with methods for cancelling, flushing and inspecting scheduled work. Calls return the last completed result or `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#typescript | TypeScript contracts}
 */
export interface ScheduledFunction<This, Args extends unknown[], Value> {
  /** Invokes or schedules the callback using the supplied arguments and receiver; returns the last completed result or `undefined`. */
  (this: This, ...args: Args): Value | undefined;
  /**
   * Discards pending calls and resets scheduling, retaining the last completed result.
   * @returns `undefined` after discarding scheduled work. Work already started continues.
   * Host timer errors propagate.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncecancel | Full API documentation}
   */
  cancel(): void;
  /**
   * Invokes eligible pending work immediately, or returns the last completed result.
   * @returns The callback result when pending work runs, or the previous result otherwise; `undefined` before any successful completion.
   * Callback, clock and host timer errors propagate. Returned promises are not awaited or caught.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debounceflush | Full API documentation}
   */
  flush(): Value | undefined;
  /**
   * Determines whether a callback invocation is scheduled.
   * @returns `true` if a callback invocation is scheduled; otherwise `false`. A leading-only cooldown or an in-flight promise alone returns `false`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncepending | Full API documentation}
   */
  pending(): boolean;
}
/**
 * Creates a function that combines a burst of calls using the latest arguments and receiver.
 * Defaults to trailing execution after calls stop. Optional `maxWait` limits postponement
 * while calls continue, subject to host timer scheduling. Construction does not invoke the
 * callback. `cancel()`, `flush()` and `pending()` manage scheduled calls; started
 * asynchronous work continues.
 * @param fn Required callback.
 * @param [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param [options] Optional non-null, non-array options object.
 * @returns A scheduled wrapper returning the last completed callback result, or
 * `undefined` before one exists. Returned promises are not awaited.
 * @throws {TypeError} If callback, duration or option types are invalid.
 * @throws {RangeError} If a duration is outside its supported range. Immediate callback
 * errors propagate; timer callback errors go to the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#debouncefn-milliseconds-options | Full API documentation}
 */
export function debounce<This, Args extends unknown[], Value>(
  fn: (this: This, ...args: Args) => Value,
  milliseconds?: number,
  options?: DebounceOptions
): ScheduledFunction<This, Args, Value>;
/**
 * Creates a function that limits callback invocation frequency while calls continue.
 * Defaults to leading and trailing execution; a lone leading call is not repeated. Uses the
 * latest arguments and receiver. `flush()` and `cancel()` can override ordinary spacing.
 * Invocation starts are limited; asynchronous work is not serialised or cancelled.
 * @param fn Required callback.
 * @param [milliseconds=0] Finite duration from 0 through 2147483647 milliseconds;
 * omitted or `undefined` means zero.
 * @param [options] Optional non-null, non-array options object.
 * @returns A scheduled wrapper returning the last completed callback result, or
 * `undefined` before one exists. Returned promises are not awaited.
 * @throws {TypeError} If callback, duration or option types are invalid.
 * @throws {RangeError} If the duration is outside its supported range. Immediate callback
 * errors propagate; timer callback errors go to the host.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#throttlefn-milliseconds-options | Full API documentation}
 */
export function throttle<This, Args extends unknown[], Value>(
  fn: (this: This, ...args: Args) => Value,
  milliseconds?: number,
  options?: ThrottleOptions
): ScheduledFunction<This, Args, Value>;

/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and every
 * awaited result is falsy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norasyncfns | Full API documentation}
 */
export function norAsync<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S, true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and every
 * awaited result is falsy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norasyncfns | Full API documentation}
 */
export function norAsync<
  P extends AnyFunction,
  const S extends readonly (((this: any, ...args: Parameters<P>) => unknown) | Nullish)[]
>(...predicates: [P, ...S]): CombinedPredicate<[P, ...S], true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the first truthy result.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if at least one predicate remains and every
 * awaited result is falsy; otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norasyncfns | Full API documentation}
 */
export function norAsync<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S, true>;
export namespace nor {
  /**
   * Creates a predicate that awaits results sequentially and stops at the first truthy result.
   * Alias of `norAsync`; the same function object. All arguments and the caller's `this`
   * reach each callback. Nullish entries are skipped; an empty list resolves to `false`.
   * Construction validates all entries immediately. Later throws or rejections reject
   * the promise unchanged and skip remaining callbacks.
   * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
   * @returns A predicate resolving to `true` if at least one predicate remains and every
   * awaited result is falsy; otherwise `false`. No type-guard narrowing is provided.
   * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#norasyncfns | Full API documentation}
   */
  const async: typeof norAsync;
}

/**
 * Creates a predicate that awaits results sequentially and stops at the second truthy result.
 * Exactly one truthy result is required; three truthy results still resolve to `false`.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if exactly one awaited result is truthy,
 * otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorasyncfns | Full API documentation}
 */
export function xorAsync<
  This,
  Args extends unknown[],
  const S extends readonly (((this: This, ...args: NoInfer<Args>) => unknown) | Nullish)[]
>(...predicates: S & (((this: This, ...args: Args) => unknown) | Nullish)[]): CombinedPredicate<S, true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the second truthy result.
 * Exactly one truthy result is required; three truthy results still resolve to `false`.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if exactly one awaited result is truthy,
 * otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorasyncfns | Full API documentation}
 */
export function xorAsync<
  P extends AnyFunction,
  const S extends readonly (((this: any, ...args: Parameters<P>) => unknown) | Nullish)[]
>(...predicates: [P, ...S]): CombinedPredicate<[P, ...S], true>;
/**
 * Creates a predicate that awaits results sequentially and stops at the second truthy result.
 * Exactly one truthy result is required; three truthy results still resolve to `false`.
 * All arguments and the caller's `this` reach each callback. Nullish entries are skipped;
 * an empty list resolves to `false`. Construction validates all entries immediately.
 * Later throws or rejections reject the promise unchanged and skip remaining callbacks.
 * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
 * @returns A predicate resolving to `true` if exactly one awaited result is truthy,
 * otherwise `false`. No type-guard narrowing is provided.
 * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorasyncfns | Full API documentation}
 */
export function xorAsync<const S extends readonly MaybeCallback[]>(...predicates: S): CombinedPredicate<S, true>;
export namespace xor {
  /**
   * Creates a predicate that awaits results sequentially and stops at the second truthy result.
   * Alias of `xorAsync`; the same function object. Exactly one truthy result is required;
   * three truthy results still resolve to `false`. All arguments and the caller's `this`
   * reach each callback. Nullish entries are skipped; an empty list resolves to `false`.
   * Construction validates all entries immediately. Later throws or rejections reject
   * the promise unchanged and skip remaining callbacks.
   * @param predicates Functions returning values, promises or thenables; nullish entries are skipped.
   * @returns A predicate resolving to `true` if exactly one awaited result is truthy,
   * otherwise `false`. No type-guard narrowing is provided.
   * @throws {TypeError} If an entry is neither a function, `null` nor `undefined`.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#xorasyncfns | Full API documentation}
   */
  const async: typeof xorAsync;
}

// Use branch-derived context only when the branches supply known inputs.
// Otherwise the common overload can infer their parameters from the predicate.
type ConditionalBranchContext<F extends AnyFunction> = [Parameters<F>] extends [[]]
  ? unknown
  : [Parameters<F>[number]] extends [never]
    ? never
    : unknown;

// whenAsync always supplies exactly one argument. A standalone zero-argument callback
// ignores it, but an empty alternative in a tuple union does not accept explicit undefined.
// Union valid unary shapes within each callback before intersecting different callbacks.
type UnaryCall<A extends unknown[]> = [A] extends [[]]
  ? { input: unknown }
  : A extends unknown
    ? A extends []
      ? never
      : [A[0]] extends A
        ? { input: A[0] }
        : A extends [...infer Prefix, infer Last]
          ? [] extends Prefix
            ? { input: Last }
            : never
          : never
    : never;
// An unconstrained contextual input contributes no restriction. Normalize it before
// intersecting callbacks so it cannot erase the other callback's concrete input.
type UnaryRequirement<F> = F extends AnyFunction
  ? { input: KnownConstraint<UnaryCall<Parameters<F>>['input']> }
  : never;
type UnaryInput<F extends AnyFunction> = (Intersection<UnaryRequirement<F>> & { input: unknown })['input'];
type ValidUnary<F extends AnyFunction> = [
  F extends unknown ? ([UnaryCall<Parameters<F>>] extends [never] ? false : true) : never
] extends [true]
  ? unknown
  : never;
type AsyncWhen<P extends AnyFunction, T extends AnyFunction> = (
  this: PredicateRequirements<[P, T]>['receiver'],
  ...args: undefined extends UnaryInput<P | T> ? [value?: UnaryInput<P | T>] : [value: UnaryInput<P | T>]
) => Promise<Awaited<UnaryInput<P | T>> | Awaited<ReturnType<T>>>;
type AsyncConditional<P extends AnyFunction, T extends AnyFunction, F extends AnyFunction> = (
  this: PredicateRequirements<[P, T, F]>['receiver'],
  ...args: PredicateRequirements<[P, T, F]>['args']
) => Promise<Awaited<ReturnType<T>> | Awaited<ReturnType<F>>>;
/**
 * Creates a unary wrapper that awaits its predicate once and conditionally transforms one input.
 * Both callbacks receive the same original input and caller's `this`; promise inputs are
 * not unwrapped before callbacks. Construction validates both callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param transform Required transformation, called only for a truthy awaited predicate result.
 * @returns A wrapper resolving to the awaited transform result when truthy, otherwise
 * the awaited original input. No type-guard narrowing is provided.
 * @throws {TypeError} If either required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
 */
export function whenAsync<
  This,
  Value,
  P extends (this: This, value: NoInfer<Value>) => unknown,
  T extends (this: This, value: NoInfer<Value>) => unknown
>(
  predicate: P & ((this: This, value: Value) => unknown) & ValidUnary<P>,
  transform: T & ((this: This, value: Value) => unknown) & ValidUnary<T>
): AsyncWhen<P, T>;
/**
 * Creates a unary wrapper that awaits its predicate once and conditionally transforms one input.
 * Both callbacks receive the same original input and caller's `this`; promise inputs are
 * not unwrapped before callbacks. Construction validates both callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param transform Required transformation, called only for a truthy awaited predicate result.
 * @returns A wrapper resolving to the awaited transform result when truthy, otherwise
 * the awaited original input. No type-guard narrowing is provided.
 * @throws {TypeError} If either required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
 */
export function whenAsync<P extends (value: UnaryInput<T>) => unknown, T extends UncontextualizedCallback>(
  predicate: P & ValidUnary<P>,
  transform: T & ValidUnary<T> & ([UnaryInput<T>] extends [never] ? never : unknown)
): AsyncWhen<P, T>;
/**
 * Creates a unary wrapper that awaits its predicate once and conditionally transforms one input.
 * Both callbacks receive the same original input and caller's `this`; promise inputs are
 * not unwrapped before callbacks. Construction validates both callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param transform Required transformation, called only for a truthy awaited predicate result.
 * @returns A wrapper resolving to the awaited transform result when truthy, otherwise
 * the awaited original input. No type-guard narrowing is provided.
 * @throws {TypeError} If either required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
 */
export function whenAsync<P extends UncontextualizedCallback, T extends (value: UnaryInput<P>) => any>(
  predicate: P & ValidUnary<P>,
  transform: T & ValidUnary<T>
): AsyncWhen<P, T>;
/**
 * Creates a unary wrapper that awaits its predicate once and conditionally transforms one input.
 * Both callbacks receive the same original input and caller's `this`; promise inputs are
 * not unwrapped before callbacks. Every possible callback contributes input and receiver
 * requirements. Construction validates both callbacks immediately. Later callback throws
 * or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param transform Required transformation, called only for a truthy awaited predicate result.
 * @returns A wrapper resolving to the awaited transform result when truthy, otherwise
 * the awaited original input. No type-guard narrowing is provided.
 * @throws {TypeError} If either required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
 */
export function whenAsync<P extends UncontextualizedCallback, T extends UncontextualizedCallback>(
  predicate: P & ValidUnary<P>,
  transform: T & ValidUnary<T>
): AsyncWhen<P, T>;
export namespace when {
  /**
   * Creates a unary wrapper that awaits its predicate once and conditionally transforms one input.
   * Alias of `whenAsync`; the same function object. Both callbacks receive the original
   * input and caller's `this`; promise inputs are not unwrapped before callbacks.
   * Construction validates both callbacks immediately. Later callback throws or rejections
   * reject the returned promise unchanged.
   * @param predicate Required condition returning a value, promise or thenable.
   * @param transform Required transformation, called only for a truthy awaited predicate result.
   * @returns A wrapper resolving to the awaited transform result when truthy, otherwise
   * the awaited original input. No type-guard narrowing is provided.
   * @throws {TypeError} If either required callback is not a function.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#whenasyncpredicate-transform | Full API documentation}
   */
  const async: typeof whenAsync;
}

/**
 * Creates a wrapper that awaits its predicate once and then awaits only the selected branch.
 * All original arguments and the caller's `this` reach the predicate and selected branch.
 * The other branch is not called. Construction validates all callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param onTrue Required branch called for a truthy awaited predicate result.
 * @param onFalse Required branch called for a falsy awaited predicate result.
 * @returns A wrapper resolving to the awaited selected branch result. No type-guard
 * narrowing is provided; inputs must be safe for every possibly reached callback.
 * @throws {TypeError} If a required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElseAsync<
  P extends (
    this: PredicateRequirements<[T, F]>['receiver'],
    ...args: PredicateRequirements<[T, F]>['args']
  ) => unknown,
  T extends UncontextualizedCallback,
  F extends UncontextualizedCallback
>(
  predicate: P,
  onTrue: T & ConditionalBranchContext<T>,
  onFalse: F & ConditionalBranchContext<F>
): AsyncConditional<P, T, F>;
/**
 * Creates a wrapper that awaits its predicate once and then awaits only the selected branch.
 * All original arguments and the caller's `this` reach the predicate and selected branch.
 * The other branch is not called. Construction validates all callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param callbacks Required predicate, truthy branch and falsy branch, in that order.
 * Each callback may return a value, promise or thenable.
 * @returns A wrapper resolving to the awaited selected branch result. No type-guard
 * narrowing is provided; inputs must be safe for every possibly reached callback.
 * @throws {TypeError} If a required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElseAsync<
  This,
  Args extends unknown[],
  const S extends readonly ((this: This, ...args: NoInfer<Args>) => unknown)[]
>(
  ...callbacks: S &
    [
      predicate: (this: This, ...args: Args) => unknown,
      onTrue: (this: This, ...args: Args) => unknown,
      onFalse: (this: This, ...args: Args) => unknown
    ]
): AsyncConditional<S[0], S[1], S[2]>;

/**
 * Creates a wrapper that awaits its predicate once and then awaits only the selected branch.
 * All original arguments and the caller's `this` reach the predicate and selected branch.
 * The other branch is not called. Construction validates all callbacks immediately.
 * Later callback throws or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param onTrue Required branch called for a truthy awaited predicate result.
 * @param onFalse Required branch called for a falsy awaited predicate result.
 * @returns A wrapper resolving to the awaited selected branch result. No type-guard
 * narrowing is provided; inputs must be safe for every possibly reached callback.
 * @throws {TypeError} If a required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElseAsync<
  P extends UncontextualizedCallback,
  T extends (...args: Parameters<P>) => any,
  F extends (...args: Parameters<P>) => any
>(predicate: P, onTrue: T, onFalse: F): AsyncConditional<P, T, F>;
/**
 * Creates a wrapper that awaits its predicate once and then awaits only the selected branch.
 * All original arguments and the caller's `this` reach the predicate and selected branch.
 * The other branch is not called. Every possible callback contributes input and receiver
 * requirements. Construction validates all callbacks immediately. Later callback throws
 * or rejections reject the returned promise unchanged.
 * @param predicate Required condition returning a value, promise or thenable.
 * @param onTrue Required branch called for a truthy awaited predicate result.
 * @param onFalse Required branch called for a falsy awaited predicate result.
 * @returns A wrapper resolving to the awaited selected branch result. No type-guard
 * narrowing is provided; inputs must be safe for every possibly reached callback.
 * @throws {TypeError} If a required callback is not a function.
 * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
 */
export function ifElseAsync<
  P extends UncontextualizedCallback,
  T extends UncontextualizedCallback,
  F extends UncontextualizedCallback
>(predicate: P, onTrue: T, onFalse: F): AsyncConditional<P, T, F>;
export namespace ifElse {
  /**
   * Creates a wrapper that awaits its predicate once and then awaits only the selected branch.
   * Alias of `ifElseAsync`; the same function object. All original arguments and the caller's
   * `this` reach the predicate and selected branch; the other branch is not called.
   * Construction validates all callbacks immediately. Later callback throws or rejections
   * reject the returned promise unchanged.
   * @param predicate Required condition returning a value, promise or thenable.
   * @param onTrue Required branch called for a truthy awaited predicate result.
   * @param onFalse Required branch called for a falsy awaited predicate result.
   * @returns A wrapper resolving to the awaited selected branch result. No type-guard
   * narrowing is provided; inputs must be safe for every possibly reached callback.
   * @throws {TypeError} If a required callback is not a function.
   * @see {@link https://github.com/koyote130708/go-fns/blob/master/docs/API.md#ifelseasyncpredicate-ontrue-onfalse | Full API documentation}
   */
  const async: typeof ifElseAsync;
}
