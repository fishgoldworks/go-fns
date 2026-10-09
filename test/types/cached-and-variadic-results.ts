import { once, partialRight, spread, and, or, xor, nor, ifElse } from '../../index';
import spreadDeep = require('../../src/spread');

const generic = once(function <T>(value: T) {
  return value;
});
generic('first');
// @ts-expect-error once caches the first result, not a new generic result per call
const cachedNumber: number = generic(123);
const genericAsync = once(async function <T>(value: T) {
  return value;
});
genericAsync('first');
// @ts-expect-error the first promise does not resolve to the latest input type
const cachedPromise: Promise<number> = genericAsync(123);
const concrete: number = once((n: number) => n + 1)(2);
const asynchronous: Promise<number> = once(async (n: number) => n + 1)(2);

const flags = partialRight((label: string, count?: number, ...flags: boolean[]) => count?.toFixed(), true);
flags('hello', undefined);
flags('hello', 3, false);
// @ts-expect-error the appended boolean must not shift into count
flags('hello');
// @ts-expect-error count is still a number or explicit undefined
flags('hello', false);
// @ts-expect-error optional count must not contaminate the variadic item type
partialRight((label: string, count?: number, ...fns: ((n: number) => string)[]) => fns[0](count ?? 0), 123);
const defaults = partialRight((a?: number, b?: string, ...values: boolean[]) => values, true);
defaults(undefined, undefined);
defaults(1, 'x', false);
// @ts-expect-error every optional prefix slot must be explicit with a saved suffix
defaults();
// @ts-expect-error second optional position must not disappear
defaults(1);
const originalOptionals = partialRight((a?: number, ...flags: boolean[]) => flags);
originalOptionals();
originalOptionals(undefined, true);
const savedFlags: boolean[] = [true, false];
partialRight((label: string, count?: number, ...flags: boolean[]) => flags, ...savedFlags)('x', undefined);
// @ts-expect-error wrong appended item type even with a union in the optional prefix
partialRight((a?: string | number, ...values: boolean[]) => values, 'x');

const format = spread((heading: string, ...ids: number[]) => heading.toUpperCase());
// @ts-expect-error missing required heading
format([]);
// @ts-expect-error heterogeneous array-like does not preserve the heading position
format({ 0: 123, length: 1 });
// @ts-expect-error a union array does not guarantee the required prefix
format([] as Array<string | number>);
format(['heading', 1, 2] as const);
const sum = spread((...ns: number[]) => ns.reduce((a, b) => a + b, 0));
sum([]);
sum({ 0: 2, 1: 3, length: 2 });
sum();
const trailing = spread((...args: [...number[], string]) => args);
// @ts-expect-error required suffix must not disappear in a variadic tuple
trailing([]);
// @ts-expect-error array-like union loses required suffix
trailing({ 0: 2, length: 1 });
trailing([1, 2, 'last']);

for (const factory of [and, or, xor, nor]) {
  const both = factory(
    (u: { active: boolean }) => u.active,
    (u: { verified: boolean }) => u.verified
  );
  both({ active: true, verified: true });
  // @ts-expect-error missing second predicate's required property
  both({ active: true });
  const receivers = factory(
    function (this: { a: number }, x: number) {
      return this.a > x;
    },
    function (this: { b: number }, x: number) {
      return this.b > x;
    }
  );
  receivers.call({ a: 1, b: 2 }, 0);
  // @ts-expect-error missing second callback's receiver
  receivers.call({ a: 1 }, 0);
}
// Existing contextual inference must survive the new heterogeneous overloads.
const same = and(
  (u: { active: boolean }) => u.active,
  null,
  (u) => u.active
);
same({ active: true });

const choose = ifElse(
  (v: string | number): v is string => typeof v === 'string',
  (v: string) => v.toUpperCase(),
  (v: number) => v.toFixed(2)
);
const text: string = choose(1);
choose('a');
// @ts-expect-error wrapper retains the original union input
choose(true);
const guardThis = ifElse(
  function (this: { p: boolean }, v: string | number): v is string {
    return typeof v === 'string';
  },
  function (this: { t: boolean }, v: string) {
    return v;
  },
  function (this: { f: boolean }, v: number) {
    return v;
  }
);
guardThis.call({ p: true, t: true, f: true }, 'x');
// @ts-expect-error guard overload requires all three receivers
guardThis.call({ p: true }, 'x');

// Native apply accepts object array-likes, but never primitive strings.
const concatenate = spread((...parts: string[]) => parts.join(''));
const boxedInput = new String('abc');
const boxedText: string = concatenate(boxedInput);
const objectText: string = concatenate({ 0: 'a', 1: 'b', length: 2 });
const readonlyText: string = concatenate(['a', 'b'] as const);
const omittedText: string = concatenate();
const nullText: string = concatenate(null);
// @ts-expect-error array-like primitive strings are rejected by native apply
concatenate('abc');
declare const primitiveText: string;
// @ts-expect-error widened strings are also primitive argument lists
concatenate(primitiveText);
declare const maybeBoxedText: string | typeof boxedInput;
// @ts-expect-error every input alternative must be an object array-like
concatenate(maybeBoxedText);
if (typeof maybeBoxedText !== 'string') concatenate(maybeBoxedText);
// @ts-expect-error primitive rejection also applies to unknown-element callbacks
spread((...values: unknown[]) => values.length)('abc');
// @ts-expect-error focused imports retain the non-primitive argument-list contract
spreadDeep((...parts: string[]) => parts.join(''))('abc');
const typedSum: number = sum(new Uint8Array([1, 2]));
void [boxedText, objectText, readonlyText, omittedText, nullText, typedSum];
