import { withDefaultArgs } from '../..';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Level = 'info' | 'error';
type Entry = { count: number; level: Level };
declare function createEntry(count: number, level: Level): Entry;

const all = withDefaultArgs(createEntry, 1, 'info');
const entry: Entry = all();

all(5);
all(undefined, 'error');
// @ts-expect-error Defaults cannot widen a callback parameter.
withDefaultArgs(createEntry, 'one', 'info');
// @ts-expect-error Defaults cannot widen a literal union.
withDefaultArgs(createEntry, 1, 'debug');
// @ts-expect-error A valid literal default does not change the callback input type.
all('one');
// @ts-expect-error Runtime null preservation does not allow an invalid typed input.
all(null);

const first = withDefaultArgs(createEntry, 1);

first(undefined, 'error');
// @ts-expect-error A later required argument still occupies its own position.
first();
// @ts-expect-error Defaults never shift a later argument to an earlier slot.
first('error');
const later = withDefaultArgs(createEntry, undefined, 'info');

later(5);
later(5, 'error');
// @ts-expect-error An undefined placeholder does not satisfy a required input.
later();
// @ts-expect-error An undefined placeholder does not supply a defined number.
later(undefined);
declare const maybeCount: number | undefined;
const uncertain = withDefaultArgs(createEntry, maybeCount, 'info');

uncertain(5);
// @ts-expect-error A possibly undefined default cannot make the number optional.
uncertain();

const unchanged = withDefaultArgs(createEntry);

unchanged(1, 'info');
// @ts-expect-error No defaults means existing requirements remain.
unchanged();
// @ts-expect-error Fixed signatures cannot receive excess defaults.
withDefaultArgs(createEntry, 1, 'info', true);
// @ts-expect-error No callable callback.
withDefaultArgs({});

const optional = withDefaultArgs((count?: number, level?: Level) => ({ count, level }), undefined, 'info');

optional();
optional(5, 'error');
const sum = (...values: number[]) => values.reduce((total, value) => total + value, 0);
const rest = withDefaultArgs(sum, undefined, 2);
const total: number = rest(1);

rest(1, undefined, 3);
// @ts-expect-error A materialised rest position must receive a valid number.
rest();
// @ts-expect-error No defined first fallback.
rest(undefined);
// @ts-expect-error Tail rest elements keep their original type.
rest(1, 2, 'three');
const headAndRest = withDefaultArgs((head: number, ...tail: string[]) => [head, ...tail], 1, 'info');

headAndRest();
headAndRest(undefined, undefined, 'error');
// @ts-expect-error The rest default must match the rest element.
withDefaultArgs(sum, 'one');

const receiver = { count: 7 };
const method = withDefaultArgs(function (this: typeof receiver, increment: number) {
  return this.count + increment;
}, 1);
const methodResult: number = method.call(receiver);

// @ts-expect-error Explicit receiver requirement remains.
method();
// @ts-expect-error Incorrect receiver.
method.call({});
const bound = withDefaultArgs(
  function (this: typeof receiver, increment: number) {
    return this.count + increment;
  }.bind(receiver),
  1
);
const boundResult: number = bound();

declare function generic<T>(value: T): T;
const genericWrapped = withDefaultArgs(generic, 'fallback');

type GenericResult = Assert<Equal<ReturnType<typeof genericWrapped>, unknown>>;
// @ts-expect-error Defaulting cannot claim the original generic identity relationship.
const unsafeGeneric: undefined = genericWrapped(undefined);

declare function overloaded(value: number): number;
declare function overloaded(value: string): string;
const selectedOverload = withDefaultArgs(overloaded, 'text');
const text: string = selectedOverload();

// @ts-expect-error Capture one coherent overload, not inputs from an earlier overload.
withDefaultArgs(overloaded, 1);
// @ts-expect-error A selected string overload cannot accept a number.
selectedOverload(1);

const predicate = withDefaultArgs((value: unknown): value is number => typeof value === 'number', 0);

type PredicateResult = Assert<Equal<ReturnType<typeof predicate>, boolean>>;
declare let unknownValue: unknown;
if (predicate(unknownValue)) {
  // @ts-expect-error The predicate inspected a possibly substituted value.
  const unsafeNarrow: number = unknownValue;
}

declare function assertNumber(value: unknown): asserts value is number;
const assertion: (value?: unknown) => void = withDefaultArgs(assertNumber, 0);

assertion(unknownValue);
// @ts-expect-error An adapted assertion cannot narrow the original input.
const unsafeAssertion: number = unknownValue;

declare const callbacks: ((value: number) => number) | ((value: string) => string);
// @ts-expect-error Narrow callback alternatives before positional defaulting.
withDefaultArgs(callbacks, 1);
declare const defaultsUnion: [number, Level] | [undefined, Level];
// @ts-expect-error Narrow correlated default tuples first.
withDefaultArgs(createEntry, ...defaultsUnion);
declare const dynamicDefaults: number[];
// @ts-expect-error Unknown-length defaults do not provide a statically safe tuple.
withDefaultArgs(sum, ...dynamicDefaults);
declare function correlated(...args: [number, string] | [string, number]): void;
// @ts-expect-error Correlated parameter alternatives need an explicit typed adapter.
withDefaultArgs(correlated, 1, 'info');

declare const optionalDefaults: [number?];
const uncertainRest = withDefaultArgs(sum, ...optionalDefaults);

uncertainRest(1);
// @ts-expect-error Optional spread positions cannot guarantee a defined fallback.
uncertainRest();
declare const opaqueDefault: unknown;
// @ts-expect-error Unknown defaults cannot satisfy a concrete callback parameter.
withDefaultArgs(createEntry, opaqueDefault, 'info');
declare const uncheckedDefault: any;
const unchecked = withDefaultArgs(createEntry, uncheckedDefault, 'info');

// @ts-expect-error An any default cannot establish a safe omission guarantee.
unchecked();
// @ts-expect-error A zero-parameter callback cannot receive default arguments.
withDefaultArgs(() => 1, 2);
// @ts-expect-error Unannotated callback inputs must not silently become contextual any.
withDefaultArgs((value) => value, 1);
const pending = withDefaultArgs(async (count: number) => count, 1);
const pendingResult: Promise<number> = pending();

declare function requiredSuffix(...args: [...number[], string]): void;
// @ts-expect-error A required suffix after a rest list needs a concrete typed adapter.
withDefaultArgs(requiredSuffix, 1);
