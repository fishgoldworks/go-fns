import { result } from '../../index';
import focused = require('../../src/result');
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
const literal: 7 = result(7);
const nullish: null = result(null);
const absent: undefined = result(undefined);
const identity = { value: 1 } as const;
const same: typeof identity = focused(identity);
const plainExtra: false = result(false, 1, 'ignored');
const contextual = result(
  (a, b) => {
    const first: number = a;

    // @ts-expect-error Contextual arguments must not become any.
    a.toUpperCase();

    return first + b;
  },
  1,
  2
);

type ContextualResult = Expect<Equal<typeof contextual, number>>;
const defaulted: number = result((n = 1) => n + 1);
const explicitDefault: number = result((n = 1) => n + 1, undefined);
const optional: string = result((s?: string) => s ?? 'default');
const rest: number = focused((...numbers: number[]) => numbers.length, 1, 2);
const callback = () => true;
const returned: typeof callback = result(() => callback);
const promise = Promise.resolve(2);
const directPromise: Promise<number> = result(promise);
const returnedPromise: Promise<number> = result(() => promise);
const thenable = {
  then(resolve: (n: number) => void) {
    resolve(2);
  }
};
const rawThenable: typeof thenable = result(() => thenable);
const bound: number = result(
  function (this: { n: number }) {
    return this.n;
  }.bind({ n: 2 })
);
const neverResult: never = result((): never => {
  throw 1;
});
const explicit: number = result<[number], number>((n) => n + 1, 2);

declare const valueOrFactory: false | ((n: number) => string);
const union: false | string = result(valueOrFactory, 2);

declare const functions: (() => 1) | (() => 2);
const callableUnion: 1 | 2 = result(functions);

declare function generic<T>(value: T): T;
const genericLiteral: 'ok' = result(generic, 'ok' as const);
const instantiated: number = result(generic<number>, 2);
const decorated = Object.assign((n: number) => n + 1, { label: 'decorated' });
const decoratedResult: number = result(decorated, 2);
const matchingFocused: typeof result = focused;

// @ts-expect-error A required argument must be supplied.
result((n: number) => n);
// @ts-expect-error Wrong callback argument type.
focused((n: number) => n, 'wrong');
// @ts-expect-error A callable union branch still requires its argument.
result(valueOrFactory);
// @ts-expect-error Plain value alternatives cannot hide unsafe callable inputs.
result(valueOrFactory, false);
class ConstructorOnly {}
// @ts-expect-error Constructor-only values cannot be invoked.
result(ConstructorOnly);
function receiver(this: { n: number }) {
  return this.n;
}

// @ts-expect-error The evaluator supplies no receiver.
result(receiver);
declare const receiverUnion: string | typeof receiver;
// @ts-expect-error All possible callbacks must accept no receiver.
result(receiverUnion);
declare const differentInputs: ((s: string) => number) | ((n: number) => string);
// @ts-expect-error Arguments must satisfy every possible callback.
result(differentInputs, 'text');
declare function overloaded(s: 'special'): number;
declare function overloaded(s: string): string;
// @ts-expect-error Overloaded callbacks need a single-signature wrapper.
result(overloaded, 'special');
declare const maybeOverloaded: typeof overloaded | string;
// @ts-expect-error Value alternatives must not erase overloaded signatures.
result(maybeOverloaded, 'special');
const wrapped: number = result(() => overloaded('special'));

declare function widerFirst(s: 'special'): unknown;
declare function widerFirst(s: string): string;
// @ts-expect-error The final signature must not hide a wider earlier return.
result(widerFirst, 'special');
declare function repeated(s: 'special'): unknown;
declare function repeated(s: string): string;
declare function repeated(s: string): string;
declare function repeated(s: string): string;
// @ts-expect-error A fixed-count overload extractor must not miss the first signature.
focused(repeated, 'special');
interface StructuredCall {
  (n: number): number;
  readonly label: string;
}
declare const structured: StructuredCall;
// @ts-expect-error Signatures that cannot be reconstructed safely need a wrapper.
result(structured, 2);
const wrappedStructured: number = result((n: number) => structured(n), 2);

const arrayArgument: number = result((xs: number[]) => xs.length, [1, 2]);
const nestedArrayArgument: number = focused((x: { values: number[] }) => x.values.length, { values: [1, 2] });
const mixedDefaults: (string | number)[] = result((a = 1, b = 'x') => [a, b], undefined, 'b');
const requiredAndDefault: number = result((a: string, b = 1) => a.length + b, 'x', undefined);
const undefinedReceiver: number = result(function (this: undefined, n: number) {
  return n;
}, 1);
const optionalReceiver: number = result(function (this: { n: number } | undefined) {
  return this?.n ?? 1;
});

// @ts-expect-error Undefined cannot satisfy a required array argument.
result((xs: number[]) => xs.length, undefined);
// @ts-expect-error A defaulted number still rejects an incompatible value.
result((a = 1, b = 'x') => [a, b], false, 'b');

const undefinedIdentity = result((n) => n, undefined);

type UndefinedIdentity = Expect<Equal<typeof undefinedIdentity, undefined>>;
const requiredDefaultRequired: number = result((a: string, b = 1, c: number) => a.length + b + c, 'x', undefined, 2);
const safeDefault = result(
  (a: number, b = 1) => {
    // @ts-expect-error A default initializer must not receive any.
    b.toUpperCase();

    return a + b;
  },
  2,
  undefined
);

type SafeDefault = Expect<Equal<typeof safeDefault, number>>;
// @ts-expect-error Mixed undefined/default calls may require explicit types for required peers.
result((a, b = 1) => a + b, 2, undefined);
const explicitPeer: number = result((a: number, b = 1) => a + b, 2, undefined);
