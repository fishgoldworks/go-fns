// Exercise callback inference and public signatures without casts.
import * as f from '../../index';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

// Direct execution must derive callback context from the actual invocation arguments.
// @ts-expect-error numbers have no toUpperCase method
f.attempt((value) => value.toUpperCase(), 123);
// @ts-expect-error numbers have no toUpperCase method
f.attemptResult((value) => value.toUpperCase(), 123);
// @ts-expect-error numbers have no toUpperCase method
f.attemptResultAsync((value) => value.toUpperCase(), 123);
// @ts-expect-error numbers have no toUpperCase method
f.repeat((value) => value.toUpperCase(), 2, 123);
// @ts-expect-error numbers have no toUpperCase method
f.repeatAsync((value) => value.toUpperCase(), 2, 123);
// @ts-expect-error numbers have no toUpperCase method
f.delay((value) => value.toUpperCase(), 0, 123);

const measured = f.attemptResult((value) => {
  type ContextIsKnown = Assert<Equal<IsAny<typeof value>, false>>;

  return value.length;
}, 'hello');

if (measured.ok) {
  const length: number = measured.value;
  // @ts-expect-error a string length is not a boolean
  const wrong: boolean = measured.value;
}

const repeated = f.repeat((value) => value.length, 2, 'hello');
const lengths: number[] = repeated;
// @ts-expect-error callback results cannot silently become any[]
const booleans: boolean[] = repeated;

async function asyncResults() {
  const measured = await f.attemptResultAsync((value) => value.length, 'hello');

  if (measured.ok) {
    const length: number = measured.value;
    // @ts-expect-error awaited callback result retains its concrete type
    const wrong: boolean = measured.value;
  }

  const repeated = await f.repeatAsync((value) => value.length, 2, 'hello');
  const lengths: number[] = repeated;
  // @ts-expect-error awaited repetitions retain their concrete result
  const wrong: boolean[] = repeated;
}

// A generic callback's parameter/result constraints must not collapse to AnyFunction.
const identity = <T extends { value: unknown }>(value: T): T => value;
const objectResult = f.attemptResult(identity, { value: 'text' });

if (objectResult.ok) {
  const record: { value: unknown } = objectResult.value;
  // @ts-expect-error the input's string value cannot be reported as numeric
  const wrong: { value: number } = objectResult.value;
}

const objectResults = f.repeat(identity, 1, { value: 'text' });
const records: Array<{ value: unknown }> = objectResults;
// @ts-expect-error generic constraint remains known rather than becoming any[]
const wrongRecords: Array<{ value: number }> = objectResults;

// Stored callbacks have no future call from which to infer an input type.
// @ts-expect-error annotate unknown callback inputs instead of receiving contextual any
f.once((value) => value.nonexistent());
// @ts-expect-error no untyped predicate-body escape hatch
f.notAsync((value) => value.nonexistent());
// @ts-expect-error right-bound callbacks without input information need an annotation
f.partialRight((value) => value.nonexistent());
const identityOnce = f.once(function identity<T>(value: T): T {
  return value;
});
const cached: unknown = identityOnce('first');
// @ts-expect-error a later call cannot change the cached type
const wrongCached: number = identityOnce(123);
const concreteOnce = f.once((value: string) => value.length);
const count: number = concreteOnce('text');
const concreteNot = f.notAsync((value: string) => value.length);
const negated: Promise<boolean> = concreteNot('text');
const concreteRight = f.partialRight((value: string, amount: number) => value.repeat(amount), 2);
const doubled: string = concreteRight('text');

// A known first stage can have a different signature from a homogeneous dynamic tail.
declare const stages: [(value: string, radix: number) => number, ...Array<(value: number) => number>];
const dynamic = f.pipe(...stages);
const numeric: number = dynamic('12', 10);

// @ts-expect-error the first stage still requires its second argument
dynamic('12');
// @ts-expect-error first-stage inputs are not inferred from the tail
dynamic(12, 10);
const dynamicAsync = f.pipeAsync(...stages);
const promisedNumeric: Promise<number> = dynamicAsync('12', 10);

// @ts-expect-error first-stage requirements also apply to async pipelines
dynamicAsync('12');

declare const receiverStages: [
  (value: string) => number,
  ...Array<(this: { enabled: boolean }, value: number) => number>
];
const withReceiver = f.pipe(...receiverStages);
const received: number = withReceiver.call({ enabled: true }, 'text');

// @ts-expect-error a possibly present tail still requires its receiver
withReceiver('text');

declare const invalidStages: [(value: string) => string, ...Array<(value: number) => number>];
// @ts-expect-error the first result is incompatible with a possible tail stage
// prettier-ignore
f.pipe(...invalidStages);
// @ts-expect-error awaiting a string does not make it a number
// prettier-ignore
f.pipeAsync(...invalidStages);

// Fallbacks for long/sparse pipelines and heterogeneous predicates must not
// silently contextualize unannotated callback bodies as any.
// @ts-expect-error annotate a sparse pipeline stage before accessing input members
// prettier-ignore
f.pipe(null, (value: string) => value, (value) => value.toFixed());
// @ts-expect-error long-pipeline fallbacks must not provide contextual any
// prettier-ignore
f.pipe((value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value) => value.nonexistent());
// @ts-expect-error annotate a sparse pipeline stage before accessing input members
// prettier-ignore
f.pipeAsync(null, (value: string) => value, (value) => value.toFixed());
// @ts-expect-error long-pipeline fallbacks must not provide contextual any
// prettier-ignore
f.pipeAsync((value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value: string) => value, (value) => value.nonexistent());
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.and((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.and((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.or((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.or((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.nor((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.nor((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.xor((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.xor((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.andAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.andAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.orAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.orAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.norAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.norAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });
// @ts-expect-error incompatible contexts require explicitly typed additional predicates
// prettier-ignore
f.xorAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v) => v.nonexistent());
// prettier-ignore
f.xorAsync((v: { active: boolean }) => v.active, (v: { verified: boolean }) => v.verified, (v: { active: boolean; verified: boolean }) => v.active && v.verified)({ active: true, verified: true });

// Context-driven overloads must retain closed argument alternatives and self receivers.
declare const closed: (...args: [] | [text: string]) => number;
f.attemptResult(closed);
f.attemptResult(closed, 'text');
// @ts-expect-error explicit undefined is not an empty argument list
f.attemptResult(closed, undefined);
// @ts-expect-error closed alternatives cannot be reopened by contextual inference
f.repeatAsync(closed, 2, 'text', 123);
declare const correlated: (...args: ['text', string] | ['count', number]) => number;
f.repeat(correlated, 2, 'text', 'hello');
f.delay(correlated, 0, 'count', 3);
// @ts-expect-error discriminant and payload remain correlated
f.attemptResultAsync(correlated, 'text', 3);
type SelfCallback = { (this: SelfCallback, value: number): number; count: number };
declare const selfCallback: SelfCallback;
const selfOutcome = f.attemptResult(selfCallback, 2);

if (selfOutcome.ok) {
  const n: number = selfOutcome.value;
}

declare const foreignReceiver: (this: { enabled: boolean }, value: number) => number;
// @ts-expect-error the callback object does not provide this receiver
f.attemptResult(foreignReceiver, 2);

// Disjoint overloads are supported via their captured signature or an explicit adapter.
declare function overloaded(value: number): string;
declare function overloaded(value: string): number;
const capturedOverload = f.attemptResult(overloaded, 'hello');

if (capturedOverload.ok) {
  const n: number = capturedOverload.value;
}

const selectedOverload = f.attemptResult((value: number) => overloaded(value), 2);

if (selectedOverload.ok) {
  const s: string = selectedOverload.value;
}

// Default initializers supply their own input types even when invocation arguments
// are omitted or explicitly undefined. Results must remain concrete.
f.attempt((value = 1) => value.toFixed());
f.delay((value = 1) => value.toFixed(), 0);
const defaultOutcome = f.attemptResult((value = 1) => value.toFixed());

if (defaultOutcome.ok) {
  type DefaultResult = Assert<Equal<typeof defaultOutcome.value, string>>;
}

const defaultRepeated = f.repeat((value = 1) => value.toFixed(), 2);

type DefaultRepeated = Assert<Equal<typeof defaultRepeated, string[]>>;
const defaultRepeatedAsync = f.repeatAsync((value = 1) => value.toFixed(), 2);

type DefaultRepeatedAsync = Assert<Equal<typeof defaultRepeatedAsync, Promise<string[]>>>;
const defaultOutcomeAsync = f.attemptResultAsync((value = 1) => value.toFixed());

type DefaultAsync = Assert<Equal<typeof defaultOutcomeAsync, Promise<f.Result<string>>>>;
const undefinedDefault = f.attemptResult((value = 1) => value.toFixed(), undefined);

type UndefinedDefault = Assert<Equal<typeof undefinedDefault, f.Result<string>>>;
const trailingDefault = f.attemptResult((label, count = 2) => label.repeat(count), 'x');

type TrailingDefault = Assert<Equal<typeof trailingDefault, f.Result<string>>>;
const explicitTrailingDefault = f.attemptResult((label, count: number = 2) => label.repeat(count), 'x', undefined);

type ExplicitTrailingDefault = Assert<Equal<typeof explicitTrailingDefault, f.Result<string>>>;
const interiorDefault = f.attemptResult(
  (value: number = 1, suffix) => {
    type DefaultInput = Assert<Equal<typeof value, number>>;
    type SuppliedInput = Assert<Equal<typeof suffix, string>>;

    return value.toFixed() + suffix;
  },
  undefined,
  'x'
);

type InteriorDefault = Assert<Equal<typeof interiorDefault, f.Result<string>>>;
const longDefault = f.attemptResult(
  (a, b, c, d, e, g, h, i, j, amount = 2) => {
    type LongInput = Assert<Equal<typeof j, number>>;

    return (a + b + c + d + e + g + h + i + j).toFixed(amount);
  },
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9
);

type LongDefault = Assert<Equal<typeof longDefault, f.Result<string>>>;
const destructuredDefault = f.attemptResult(({ value } = { value: 1 }) => value.toFixed());

type DestructuredDefault = Assert<Equal<typeof destructuredDefault, f.Result<string>>>;
const destructuredUndefined = f.attemptResult(({ value } = { value: 1 }) => value.toFixed(), undefined);

type DestructuredUndefined = Assert<Equal<typeof destructuredUndefined, f.Result<string>>>;
const cachedDefault = f.once(({ value } = { value: 1 }) => value.toFixed());
const cachedDefaultValue = cachedDefault();

type CachedDefault = Assert<Equal<typeof cachedDefaultValue, string>>;
const defaultNot = f.notAsync(({ value } = { value: 1 }) => value > 0);
const defaultNegation: Promise<boolean> = defaultNot();
const defaultRight = f.partialRight(({ value } = { value: 1 }) => value.toFixed());
const defaultRightValue: string = defaultRight();
const sparseDefault = f.pipe(null, (value = 1) => value.toFixed());
const sparseDefaultValue: string = sparseDefault();
const sparseDestructured = f.pipe(null, ({ value } = { value: 1 }) => value.toFixed(), undefined);
const sparseDestructuredValue: string = sparseDestructured();
const sparseDefaultAsync = f.pipeAsync(null, (value = 1) => value.toFixed());
const sparseDefaultAsyncValue: Promise<string> = sparseDefaultAsync();
const sparseManyNulls = f.pipe(null, undefined, null, (value = 1) => value.toFixed());
const sparseManyNullsValue: string = sparseManyNulls();
const trailingNullDefault = f.pipe((value = 1) => value.toFixed(), null, undefined);
const trailingNullDefaultValue: string = trailingNullDefault();

// The default-preserving contexts do not authorize arguments that the captured
// callback cannot receive, including closed tuple and optional-callback unions.
const numericDefault = (value = 1) => value.toFixed();

// @ts-expect-error zero-argument compatibility cannot hide a wrong supplied argument
f.attemptResult(numericDefault, 'wrong');
// @ts-expect-error zero-argument compatibility cannot hide a wrong supplied argument
f.repeat(numericDefault, 2, 'wrong');
// @ts-expect-error explicit undefined does not reopen a closed tuple alternative
f.attemptResult(closed, undefined);
declare const optionalUnion: ((value?: string) => string) | ((value?: number) => number);
f.attemptResult(optionalUnion);
// @ts-expect-error supplied input must be safe for every optional union member
f.attemptResult(optionalUnion, 'wrong');
// @ts-expect-error required callbacks do not become callable with zero arguments
f.attemptResult((value: number) => value.toFixed());
// @ts-expect-error an interior undefined cannot stand in for a required numeric input
f.attemptResult((value: number, suffix: string) => value.toFixed() + suffix, undefined, 'x');
f.pipe(
  // @ts-expect-error single-stage overloads do not skip incompatible later callbacks
  null,
  (value: string) => value,
  (value: number) => value
);
// @ts-expect-error single-stage overloads retain receiver requirements
f.pipe(null, function (this: { enabled: boolean }, value = 1) {
  return this.enabled ? value : 0;
})();
// @ts-expect-error defaulted callbacks still retain concrete result types
const defaultWrongResult: number[] = f.repeat((value = 1) => value.toFixed(), 2);

// @ts-expect-error even defaulted callback bodies reject invalid member access
f.attemptResult((value = 1) => value.toUpperCase());
// @ts-expect-error no unsafe stored callback context for a destructured default
f.once(({ value } = { value: 1 }) => value.nonexistent());

// Default support must not replace ordinary generic argument/result inference.
function unconstrainedIdentity<T>(value: T): T {
  return value;
}

const exactIdentity = f.attemptResult(unconstrainedIdentity, 'text');

type ExactIdentity = Assert<Equal<typeof exactIdentity, f.Result<string>>>;
const constrainedIdentity = <T extends { value: unknown }>(value: T): T => value;
const exactConstrained = f.attemptResult(constrainedIdentity, { value: 'text' });

type ExactConstrained = Assert<Equal<typeof exactConstrained, f.Result<{ value: string }>>>;
function firstOf<T>(values: T[]): T | undefined {
  return values[0];
}

const genericRepeated = f.repeat(firstOf, 2, [1, 2]);

type GenericRepeated = Assert<Equal<typeof genericRepeated, Array<number | undefined>>>;

// Explicit undefined remains a known input for ordinary callbacks. Defaults in
// mixed tuples can be annotated to distinguish their initializer type from it.
const knownUndefined = f.attemptResult(
  (value, suffix) => {
    type KnownUndefined = Assert<Equal<typeof value, undefined>>;
    type KnownSuffix = Assert<Equal<typeof suffix, string>>;

    return suffix;
  },
  undefined,
  'x'
);

type KnownUndefinedResult = Assert<Equal<typeof knownUndefined, f.Result<string>>>;
const interiorObjectDefault = f.attemptResult(
  ({ value }: { value: number } = { value: 1 }, suffix) => value.toFixed() + suffix,
  undefined,
  'x'
);

type InteriorObjectDefault = Assert<Equal<typeof interiorObjectDefault, f.Result<string>>>;
