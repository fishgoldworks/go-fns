import * as f from '../..';
import { pipe, pipeAsync, tap, tapAsync, attemptResult, attemptResultAsync, once, sleep, type Result } from '../..';
import sourcePipe = require('../../src/pipe');
import sourceOnce = require('../../src/once');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
const lengths = pipe(
  (text: string) => text.trim(),
  (text) => text.length
);
type Lengths = Assert<Equal<ReturnType<typeof lengths>, number>>;
const numeric: number = lengths(' hi ');
// @ts-expect-error incorrect invocation argument
lengths(3);
pipe(
  // @ts-expect-error incompatible stage input
  (text: string) => text.length,
  (length: boolean) => !length
);
pipe(
  // @ts-expect-error subsequent stage cannot require two arguments
  (n: number) => n,
  (a: number, b: number) => a + b
);
const empty = pipe();
const undef: undefined = empty('anything');
const nullish = pipe(
  null,
  (s: string) => s.length,
  undefined,
  (n: number) => n * 2
);
const nullishResult: number = nullish('ab');
pipe(
  // @ts-expect-error nullish gaps must not conceal an invalid chain
  null,
  (s: string) => s.length,
  undefined,
  (value: boolean) => !value
);
const long = pipe(
  (n: number) => n,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => n + 1,
  (n: number) => String(n)
);
const longResult: string = long(2);
pipe(
  // @ts-expect-error invalid long chain is still rejected
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: number) => n,
  (n: boolean) => n
);
const asyncLengths = pipeAsync(
  async (text: string) => text.trim(),
  (text) => text.length
);
const lengthPromise: Promise<number> = asyncLengths(' hi ');
pipeAsync(
  // @ts-expect-error async results are awaited before the next stage
  async (text: string) => text.length,
  (n: Promise<number>) => n
);
const asyncNulls = pipeAsync(
  null,
  async (n: number) => n + 1,
  undefined,
  (n: number) => String(n)
);
const asyncNullResult: Promise<string> = asyncNulls(1);
const asyncEmpty: Promise<undefined> = pipeAsync()('anything');
const named: typeof pipeAsync = pipe.async;
const resultAlias: typeof attemptResult = f.attempt.result;
const asyncResultAlias: typeof attemptResultAsync = f.attempt.resultAsync;
const resultAsyncAlias: typeof attemptResultAsync = attemptResult.async;
const tapAlias: typeof tapAsync = tap.async;
const sourceAlias: typeof pipeAsync = sourcePipe.async;

const receiverPipeline = pipe(
  function (this: { prefix: string }, s: string) {
    return this.prefix + s;
  },
  function (this: { suffix: string }, s) {
    return s + this.suffix;
  }
);
const receiverResult: string = receiverPipeline.call({ prefix: 'a', suffix: 'b' }, 'x');
// @ts-expect-error receiver is required
receiverPipeline('x');
// @ts-expect-error all receiver requirements must be met
receiverPipeline.call({ prefix: 'a' }, 'x');
const asyncReceiver = pipeAsync(
  function (this: { id: number }, n: number) {
    return this.id + n;
  },
  async (n) => n * 2
);
const receiverPromise: Promise<number> = asyncReceiver.call({ id: 2 }, 3);
// @ts-expect-error async receiver cannot be omitted
asyncReceiver(3);

const result = attemptResult((n: number) => n * 2, 3);
if (result.ok) {
  const value: number = result.value;
  // @ts-expect-error no error on success
  void result.error;
} else {
  const error: unknown = result.error;
  // @ts-expect-error no value on failure
  void result.value;
}
const arbitrary: Result<string> = { ok: false, error: undefined };
// @ts-expect-error wrong callback arguments
attemptResult((n: number) => n * 2, 'no');
const promiseResult: Promise<Result<number>> = attemptResultAsync(async (n: number) => n * 2, 3);
const syncPromise: Result<Promise<number>> = attemptResult(() => Promise.resolve(1));
function needsReceiver(this: { id: number }, n: number) {
  return this.id + n;
}
// @ts-expect-error attempt variants use the callback itself as receiver; bind explicitly
attemptResult(needsReceiver, 2);
const boundResult: Result<number> = attemptResult(needsReceiver.bind({ id: 1 }), 2);
// @ts-expect-error arbitrary caught values make attempt return unknown
const unsafeNumber: number = f.attempt((x: number) => x, 1);

const person = { id: 1, name: 'Michael' };
const observe = tap((value: { id: number }) => value.id);
const preserved = observe(person);
const name: string = preserved.name;
// @ts-expect-error required observed input
observe();
// @ts-expect-error incompatible observed input
observe('x');
const asyncObserved: Promise<typeof person> = tapAsync(async (value: { id: number }) => value.id)(person);
const promiseObserved: Promise<number> = tapAsync((value: Promise<number>) => {})(Promise.resolve(2));
const observedReceiver = tap(function (this: { count: number }, n: number) {
  this.count += n;
});
// @ts-expect-error observer receiver required
observedReceiver(1);
observedReceiver.call({ count: 0 }, 1);

const addOnce = once((a: number, b: number) => a + b);
const sum: number = addOnce(1, 2);
// @ts-expect-error required arguments retained
addOnce(1);
// @ts-expect-error wrong argument type
addOnce('1', 2);
const get = once(async () => 3);
const got: Promise<number> = get();
const boundOnce = sourceOnce(needsReceiver);
// @ts-expect-error once forwards required caller receiver
boundOnce(3);
const onceResult: number = boundOnce.call({ id: 1 }, 3);
// @ts-expect-error no invented reset API
addOnce.reset();
const repeated: number[] = f.repeat((n: number) => n * 2, 3, 2);
// @ts-expect-error preserve repeat callback argument types
f.repeat((n: number) => n * 2, 3, 'no');
const predicate = f.and(
  (u: { enabled: boolean }) => u.enabled,
  null,
  (u) => u.enabled
);
const allowed: boolean = predicate({ enabled: true });
// @ts-expect-error wrong predicate argument
predicate('x');
const negated = f.not((n: number) => n > 0);
const no: boolean = negated(0);
// @ts-expect-error not preserves predicate arguments
negated('x');
const spread = f.spread((a: number, b: string) => a + b);
const joined: string = spread([1, 'x'] as const);
// @ts-expect-error heterogeneous tuple elements are wrong
spread(['x', 1] as const);
const wait: Promise<void> = sleep(0);
const waitDefault: Promise<void> = sleep();
// @ts-expect-error duration cannot be a string
sleep('3');
// @ts-expect-error null is not a default duration
sleep(null);
// @ts-expect-error unsupported options
sleep(0, { milliseconds: 1 });
const signal: f.AbortSignalLike = {
  aborted: false,
  reason: undefined,
  addEventListener(type, listener) {},
  removeEventListener(type, listener) {}
};
sleep(2, { signal });
// @ts-expect-error malformed signal
sleep(2, { signal: { aborted: false } });

const maybeStage: ((n: number) => string) | undefined = Math.random() > 0.5 ? (n) => String(n) : undefined;
const optionalPipeline = pipe((n: number) => n, maybeStage);
const optionalResult: number | string = optionalPipeline(1);
// @ts-expect-error optional stage may be absent
const optionalWrong: string = optionalPipeline(1);
pipe(
  // @ts-expect-error every optional execution path must be compatible
  (n: number) => n,
  maybeStage,
  (s: string) => s.length
);
const homogeneous: Array<(n: number) => number> = [(n) => n + 1];
const homogeneousResult: number | undefined = pipe(...homogeneous)(1);
const nulls: Array<null | undefined> = [];
const noStages: undefined = pipe(...nulls)('anything');
const optionalAsyncResult: Promise<number | string> = pipeAsync((n: number) => n, maybeStage)(2);
pipeAsync(
  // @ts-expect-error async path validation includes skipped optional stages
  (n: number) => n,
  maybeStage,
  async (s: string) => s.length
);
const observationsWithoutInput: undefined = tap(() => {})();
const asyncObservationsWithoutInput: Promise<undefined> = tapAsync(() => {})();
// Composition helpers themselves retain useful inference in pipelines.
const tappedText = pipe(
  (s: string) => s.trim(),
  tap((s: string) => {}),
  (s) => s.length
);
const tappedNumber: number = tappedText('hi');
const asyncTappedText = pipeAsync(
  async (s: string) => s.trim(),
  tapAsync(async (s: string) => {}),
  (s) => s.length
);
const asyncTappedNumber: Promise<number> = asyncTappedText('hi');
pipe(
  // @ts-expect-error tap must not hide an incompatible stage input
  (n: number) => n,
  tap((s: string) => {})
);
// @ts-expect-error wrapped constructor types do not become callable
once(class NotAFunction {});
// Nested observer factories may need an explicit parameter annotation.
// @ts-expect-error do not silently make unannotated observer inputs any
tap((value) => value.title);
