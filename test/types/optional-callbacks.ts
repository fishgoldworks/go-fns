import { and, or, nor, xor, once, partialRight, spread, ifElse, debounce, throttle } from '../../index';
const a = (v: { active: boolean }) => v.active;
const b: ((v: { verified: boolean }) => boolean) | undefined = Math.random() > 0.5 ? (v) => v.verified : undefined;
for (const factory of [and, or, xor, nor]) {
  const f = factory(a, b);
  f({ active: true, verified: true });
  // @ts-expect-error a possibly present predicate's requirements must remain enforced
  f({ active: true });
  const first = function (this: { a: number }, v: { active: boolean }) {
    return this.a && v.active;
  };
  const optional: ((this: { b: number }, v: { verified: boolean }) => boolean) | undefined =
    Math.random() > 0.5
      ? function (v) {
          return this.b > 0 && v.verified;
        }
      : undefined;
  const withThis = factory(first, optional);
  withThis.call({ a: 1, b: 2 }, { active: true, verified: true });
  // @ts-expect-error optional predicate receiver cannot be dropped
  withThis.call({ a: 1 }, { active: true, verified: true });
  // @ts-expect-error optional predicate input cannot be dropped
  withThis.call({ a: 1, b: 2 }, { active: true });
  const mixedArity = factory(
    () => true,
    (x: { a: number }) => x.a,
    (x: { b: string }, limit: number) => x.b.length > limit
  );
  mixedArity({ a: 1, b: 'hello' }, 1);
  // @ts-expect-error all required inputs are retained even if some callbacks ignore them
  mixedArity({ a: 1, b: 'hello' });
  // @ts-expect-error required second field cannot disappear
  mixedArity({ a: 1 }, 1);
}
// Stateful schedulers must not invent a fresh generic result from a later input.
for (const schedule of [debounce, throttle]) {
  const f = schedule(
    function <T>(v: T) {
      return v;
    },
    100,
    { leading: true }
  );
  f('first');
  // @ts-expect-error may return a previous invocation's string
  const n: number | undefined = f(3);
  f.cancel();
}
const bounded = once(<T extends { id: number }>(v: T) => v);
const firstInput = { id: 1, name: 'a' };
const first = bounded(firstInput);
const nextInput = { id: 2, other: true };
const next = bounded(nextInput);
const id: number = next.id;
// @ts-expect-error once returns the constraint, not a later invocation's subtype
const flag: boolean = next.other;
// @ts-expect-error still enforces the generic constraint
bounded('bad');

const optionalRest = partialRight(
  (x?: string, ...fns: ((n: number) => string)[]) => fns,
  (n: number) => '' + n
);
optionalRest(undefined);
optionalRest('x', (n) => '' + n);
// @ts-expect-error cannot put the formatter in x
optionalRest();
// @ts-expect-error must not accept a union that includes the optional prefix type
partialRight((x?: string, ...fns: ((n: number) => string)[]) => fns, 'bad');
const suffixOnly = (...args: [...number[], string]) => args;
// @ts-expect-error ambiguous variadic suffix layouts use explicit typed adapters
partialRight(suffixOnly, 1);
const exact: readonly [string, ...number[]] = ['a', 1];
const formatter = spread((name: string, ...ids: number[]) => name.length);
const result: number = formatter(exact);
// @ts-expect-error optional first argument does not prove required first argument
formatter([] as [name?: string, ...ids: number[]]);
const choices = ifElse(
  (x: string | null): x is string => x !== null,
  (x) => x.length,
  (x) => (x === null ? -1 : 0)
);
const length: number = choices(null);

const dynamicPredicates: (((v: { a: number }) => unknown) | ((v: { b: string }) => unknown) | null)[] = [
  (v: { a: number }) => v.a
];
// Both possible predicate types have to be satisfied by a dynamic list.
const dynamic = and(...dynamicPredicates);
dynamic({ a: 1, b: 'x' });
// @ts-expect-error dynamic lists must not discard a possible requirement
dynamic({ a: 1 });
const noArgs = and(() => true, null, undefined);
noArgs();
const nullableFunction: ((this: { a: number }, v: { x: number }) => boolean) | null =
  Math.random() > 0.5
    ? function (v) {
        return this.a > v.x;
      }
    : null;
const optionalThis = and(() => true, nullableFunction);
optionalThis.call({ a: 2 }, { x: 1 });
// @ts-expect-error even optional receiver requirements must be retained
optionalThis({ x: 1 });

const unionCallback = Math.random() > 0.5 ? (value: string) => value.toUpperCase() : (value: number) => value.toFixed();
const unionOnce = once(unionCallback);
// @ts-expect-error the cached callback may require a string on its first invocation
unionOnce(1);
// @ts-expect-error the cached callback may require a number on its first invocation
unionOnce('x');
const unionReceiver =
  Math.random() > 0.5
    ? function (this: { a: string }) {
        return this.a.toUpperCase();
      }
    : function (this: { b: number }) {
        return this.b.toFixed();
      };
const bothReceivers = once(unionReceiver);
bothReceivers.call({ a: 'x', b: 1 });
// @ts-expect-error a union callback must satisfy both possible receiver requirements
bothReceivers.call({ a: 'x' });
const tagged = (...args: [tag: 'a', ...flags: boolean[]] | [tag: 'b', ...counts: number[]]) => args;
// @ts-expect-error a boolean suffix is not valid for all possible prefix branches
partialRight(tagged, true);
