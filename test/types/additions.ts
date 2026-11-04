import {
  partial,
  partialRight,
  unary,
  when,
  ifElse,
  repeat,
  repeatAsync,
  debounce,
  throttle,
  pipe,
  ScheduledFunction,
  sleep,
  SleepOptions,
  ThrottleOptions,
  DebounceOptions
} from '../../index';
import partialDeep = require('../../src/partial');
import throttleDeep = require('../../src/throttle');
import debounceDeep = require('../../src/debounce');
import sleepDeep = require('../../src/sleep');

const add = (a: number, b: number): number => a + b;
const addOne: (b: number) => number = partial(add, 1);
const addLast: (a: number) => number = partialRight(add, 1);
const all: () => number = partial(add, 1, 2);
const allRight: () => number = partialRight(add, 1, 2);
const noBinding: typeof add = partial(add);
const noRightBinding: typeof add = partialRight(add);
// @ts-expect-error bad leading argument
partial(add, '1');
// @ts-expect-error bad trailing argument
partialRight(add, '1');
// @ts-expect-error more saved arguments than callback accepts
partial(add, 1, 2, 3);
// @ts-expect-error missing remaining argument
partial(add, 1)();
// @ts-expect-error bad remaining argument
partialRight(add, 1)('2');
// @ts-expect-error too many saved arguments
partialRight(add, 1, 2, 3);
const optional = (title: string, count?: number): string => title + count;
const optionalCount: (count?: number) => string = partial(optional, 'title');
const titleOnly: (title: string) => string = partialRight(optional, 3);
const rest = (prefix: string, ...numbers: number[]): string => prefix + numbers.join(',');
const restNumbers: (...numbers: number[]) => string = partial(rest, 'x');
const fixedMore: (...numbers: number[]) => string = partial(rest, 'x', 1, 2);
const pretty: (value: unknown) => string | undefined = partialRight(JSON.stringify, null, 2);
const mapped: (string | undefined)[] = [{ a: 1 }].map(unary(pretty));
const sum = (...args: number[]): number => args.length;
const rightRest: (...args: number[]) => number = partialRight(sum, 1, 2);

const receiver = { prefix: 'x', other: 1 };
function method(this: { prefix: string }, n: number, label: string) {
  return this.prefix + n + label;
}
const boundHead = partial(method, 1);
const boundTail = partialRight(method, 'a');
boundHead.call(receiver, 'b');
boundTail.call(receiver, 2);
// @ts-expect-error missing callback receiver
boundHead('b');
// @ts-expect-error incompatible callback receiver
boundTail.call({}, 2);
const deepPartial: typeof partial = partialDeep;

const parsed: number[] = ['10', '20'].map(unary(parseInt));
const noArgs: number = unary(() => 1)();
// @ts-expect-error callback cannot require a second input that unary omits
unary((a: number, b: number) => a + b);
// @ts-expect-error string is required
unary(parseInt)();
// @ts-expect-error unary wrapper accepts one argument
unary(parseInt)('10', 2);
const unaryThis = unary(function (this: { ok: boolean }, value: number) {
  return this.ok && value > 0;
});
const unaryBool: boolean = unaryThis.call({ ok: true }, 3);
// @ts-expect-error callback receiver is required
unaryThis(2);

const title: string = when(
  (x: string) => !x.length,
  () => 'Untitled'
)('');
const changed: string | number = when(
  (x: string) => x.length === 0,
  () => 0
)('');
const stringCondition = (x: string) => !!x;
const numberTransform = (x: number) => x;
// @ts-expect-error callback input types disagree
when(stringCondition, numberTransform);
const stringWrapper = when(
  (x: string) => !!x,
  (x) => x
);
// @ts-expect-error wrong wrapper input
stringWrapper(3);
const narrowed = when(
  (x: string | null): x is string => x !== null,
  (x) => x.length
);
const narrowResult: string | null | number = narrowed(null);
const choose: string | number = ifElse(
  (x: number, y: number) => x > y,
  (x, y) => x + y,
  () => 'no'
)(1, 2);
const conditionalIgnore = ifElse(
  () => true,
  (x: number) => x + 1,
  (x: number) => x - 1
);
const ignoreResult: number = conditionalIgnore(1);
ifElse(
  // @ts-expect-error branches must accept compatible inputs
  (x: string) => !!x,
  (x: number) => x,
  () => 0
);
// @ts-expect-error both branches are required
ifElse(
  (x: number) => !!x,
  (x) => x
);
const choice = ifElse(
  function (this: { p: boolean }, x: number) {
    return this.p;
  },
  function (this: { a: number }, x: number) {
    return this.a + x;
  },
  function (this: { b: string }, x: number) {
    return this.b + x;
  }
);
const c: number | string = choice.call({ p: true, a: 1, b: '' }, 2);
// @ts-expect-error requires all callback receivers
choice.call({ p: true }, 2);
const pipelineResult: string = pipe(
  (x: string) => x.trim(),
  when(
    (x: string) => x.length === 0,
    () => 'Untitled'
  )
)('');

const repetitions: Promise<number[]> = repeatAsync(async (n: number) => n + 1, 2, 3);
const repeatedNull: Promise<number[]> = repeatAsync(() => 1, null);
// @ts-expect-error count must be numeric
repeatAsync(() => 1, '2');
// @ts-expect-error callback argument is missing
repeatAsync((x: number) => x, 2);
// @ts-expect-error callback receiver is callback itself, not arbitrary receiver
repeatAsync(function (this: { custom: true }) {
  return 1;
}, 2);

const scheduled = debounce((query: string) => query.length, 250, { maxWait: 1000 });
const maybeNumber: number | undefined = scheduled('query');
const maybeNumber2: number | undefined = scheduled.flush();
const isPending: boolean = scheduled.pending();
const nothing: void = scheduled.cancel();
// @ts-expect-error scheduled result may not exist yet
const certainNumber: number = scheduled('query');
// @ts-expect-error callback args preserved
scheduled(3);
// @ts-expect-error a required input cannot disappear
scheduled();
// @ts-expect-error options require booleans
throttle(() => 1, 3, { leading: 'yes' });
// @ts-expect-error throttle does not support maxWait
throttle(() => 1, 3, { maxWait: 10 });
// @ts-expect-error maxWait must be numeric
debounce(() => 1, 3, { maxWait: '10' });
// @ts-expect-error duration is not nullish
debounce(() => 1, null);
const maybePromise: Promise<number> | undefined = debounce(async () => 1)();
const scheduledThis = throttle(function (this: { limit: number }, n: number) {
  return this.limit + n;
});
const number3: number | undefined = scheduledThis.call({ limit: 3 }, 1);
// @ts-expect-error correct receiver is required
scheduledThis(1);
const withOptional: ScheduledFunction<unknown, [value?: number], number> = debounce((value = 0) => value);
withOptional();
const deepThrottle: typeof throttle = throttleDeep;

// Infer wrappers without a contextual assignment hiding missing inference.
const inferredRight = partialRight((n: number, label: string) => label + n, 'x');
const inferredString: string = inferredRight(2);
// @ts-expect-error remaining parameter is number, not unknown
inferredRight('2');
const optionalSlots = partialRight((n: number, label?: string, count?: number) => n + (count || 0), 3);
optionalSlots(1, undefined);
optionalSlots(1, 'x');
// @ts-expect-error no padding: omitting the prefix slot would shift the saved count
optionalSlots(1);
const restPrefix = partialRight((title: string, ...numbers: number[]) => title + numbers.length, 1, 2);
restPrefix('a');
restPrefix('a', 3, 4);
// @ts-expect-error required prefix remains required
restPrefix();
// @ts-expect-error saved suffix must match variadic item type
partialRight((title: string, ...numbers: number[]) => title, 'bad');
const ignoreTrue = ifElse(
  () => false,
  () => 'x',
  (n: number) => n + 1
);
const ignoreTrueResult: string | number = ignoreTrue(1);

// Explicit undefined selects the documented defaults, including under exactOptionalPropertyTypes.
const sleepDefaults: SleepOptions = { signal: undefined };
const throttleDefaults: ThrottleOptions = { leading: undefined, trailing: undefined };
const debounceDefaults: DebounceOptions = { ...throttleDefaults, maxWait: undefined };
const defaultSleep: Promise<void> = sleep(0, sleepDefaults);
const defaultDeepSleep: Promise<void> = sleepDeep(0, { signal: undefined });
const defaultThrottle = throttle((value: number) => value, 0, throttleDefaults);
const defaultDeepThrottle = throttleDeep((value: number) => value, 0, { leading: undefined, trailing: undefined });
const defaultDebounce = debounce((value: number) => value, 0, debounceDefaults);
const defaultDeepDebounce = debounceDeep((value: number) => value, 0, {
  leading: undefined,
  trailing: undefined,
  maxWait: undefined
});
const defaultScheduledResult: number | undefined = defaultDebounce(1);
const defaultFlushedResult: number | undefined = defaultThrottle.flush();
sleep(0, {});
throttle((value: number) => value, 0, {});
debounce((value: number) => value, 0, {});
function configuredTimers(leading: boolean | undefined, trailing: boolean | undefined, maxWait: number | undefined) {
  throttle((value: number) => value, 0, { leading, trailing });
  debounce((value: number) => value, 0, { leading, trailing, maxWait });
}
function configuredSleep(signal: SleepOptions['signal']) {
  return sleep(0, { signal });
}
// @ts-expect-error null is not an omitted cancellation signal
sleep(0, { signal: null });
// @ts-expect-error a structural cancellation signal still requires event methods
sleepDeep(0, { signal: { aborted: false, reason: undefined } });
// @ts-expect-error optional leading accepts only boolean or undefined
throttle((value: number) => value, 0, { leading: 1 });
// @ts-expect-error optional trailing accepts only boolean or undefined
throttleDeep((value: number) => value, 0, { trailing: null });
// @ts-expect-error optional leading accepts only boolean or undefined
debounceDeep((value: number) => value, 0, { leading: 'true' });
// @ts-expect-error optional maxWait accepts only number or undefined
debounce((value: number) => value, 0, { maxWait: '10' });
// @ts-expect-error default options must not widen the scheduled argument type
defaultDeepDebounce('wrong');
// @ts-expect-error default options must not widen the scheduled argument type
defaultDeepThrottle('wrong');
