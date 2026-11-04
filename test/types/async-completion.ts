import api, { whenAsync, ifElseAsync, norAsync, xorAsync } from '../../index';
import deepWhenAsync = require('../../src/whenAsync');
import deepIfElseAsync = require('../../src/ifElseAsync');
import deepNorAsync = require('../../src/logic/norAsync');
import deepXorAsync = require('../../src/logic/xorAsync');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// Every entry point retains the full factory contract.
type DeepWhen = Assert<Equal<typeof deepWhenAsync, typeof whenAsync>>;
type DeepIfElse = Assert<Equal<typeof deepIfElseAsync, typeof ifElseAsync>>;
type DeepNor = Assert<Equal<typeof deepNorAsync, typeof norAsync>>;
type DeepXor = Assert<Equal<typeof deepXorAsync, typeof xorAsync>>;
const defaultWhen: typeof whenAsync = api.whenAsync;
const defaultIfElse: typeof ifElseAsync = api.ifElseAsync;
const defaultNor: typeof norAsync = api.norAsync;
const defaultXor: typeof xorAsync = api.xorAsync;

declare const thenable: PromiseLike<string>;
declare const unknownResult: unknown;
const transformed = whenAsync(
  (value: number) => Promise.resolve(value > 0),
  (value) => Promise.resolve(value.toFixed())
);
const transformedResult: Promise<number | string> = transformed(1);
type TransformedResult = Assert<Equal<ReturnType<typeof transformed>, Promise<number | string>>>;
// @ts-expect-error the factory returns a wrapper synchronously
const factoryPromise: Promise<unknown> = transformed;
// @ts-expect-error even synchronous outcomes are returned asynchronously
const syncTransform: number | string = whenAsync(
  (value: number) => value,
  (value) => value.toFixed()
)(1);
// @ts-expect-error the predicate and transform require a numeric input
transformed('one');
// @ts-expect-error the required input cannot be omitted
transformed();
// @ts-expect-error whenAsync accepts exactly one input
transformed(1, 2);
const customTransform = whenAsync(
  (value: number) => unknownResult,
  () => thenable
);
type CustomTransform = Assert<Equal<ReturnType<typeof customTransform>, Promise<number | string>>>;
const unknownTransform = whenAsync(
  (value: number) => thenable,
  () => unknownResult
);
type UnknownTransform = Assert<Equal<ReturnType<typeof unknownTransform>, Promise<unknown>>>;
const optionalTransform = whenAsync(
  (value?: number) => value,
  (value?: number) => value ?? 0
);
optionalTransform();
optionalTransform(1);
type OptionalTransform = Assert<Equal<ReturnType<typeof optionalTransform>, Promise<number | undefined>>>;
const ignoredTransform = whenAsync(
  () => false,
  () => 'ignored'
);
ignoredTransform();
ignoredTransform(1);
// @ts-expect-error ignored callbacks still yield a unary wrapper
ignoredTransform(1, 2);
const requiredTransform = whenAsync(
  (value?: number) => value,
  (value: number) => value + 1
);
requiredTransform(1);
// @ts-expect-error an optional predicate cannot erase the transform's required input
requiredTransform();
// @ts-expect-error both callbacks are required
whenAsync(() => true);
// @ts-expect-error null is not a predicate
whenAsync(null, () => 1);
// @ts-expect-error undefined is not a transform
whenAsync(() => true, undefined);
whenAsync(
  // @ts-expect-error the predicate cannot require a second argument that is never forwarded
  (value: number, label: string) => value && label,
  (value: number) => value
);
whenAsync(
  (value: number) => value,
  // @ts-expect-error the transform cannot require a second argument that is never forwarded
  (value: number, label: string) => value + label
);
const restWhen = whenAsync(
  (...values: number[]) => values.length,
  (value: number, ...labels: string[]) => value
);
restWhen(1);
// @ts-expect-error additional wrapper arguments are not accepted even for rest callbacks
restWhen(1, 'label');

// Callbacks receive the original promise; only the returned false-path value is awaited.
const promisedInput = whenAsync(
  (value: PromiseLike<number>) => value.then(Boolean),
  () => 'selected'
);
type PromisedInput = Assert<Equal<ReturnType<typeof promisedInput>, Promise<number | string>>>;
promisedInput(Promise.resolve(2));
// @ts-expect-error callbacks receive promises, not their resolved values
promisedInput(2);
const impossiblePromiseInput = whenAsync(
  (value: Promise<number>) => value,
  (value: number) => value
);
// @ts-expect-error a promise cannot satisfy the transform's numeric input
impossiblePromiseInput(Promise.resolve(2));
// @ts-expect-error a number cannot satisfy the predicate's promise input
impossiblePromiseInput(2);

const whenReceiver = whenAsync(
  function (this: { enabled: boolean }, value: number) {
    return this.enabled && value;
  },
  function (this: { label: string }, value: number) {
    return Promise.resolve(this.label + value);
  }
);
whenReceiver.call({ enabled: true, label: 'n' }, 1);
// @ts-expect-error both callback receivers remain required
whenReceiver.call({ enabled: true }, 1);
// @ts-expect-error required receivers cannot be omitted
whenReceiver(1);
declare const unaryUnion: (() => unknown) | ((this: { minimum: number }, value: number) => Promise<boolean>);
const whenUnion = whenAsync(unaryUnion, (value: number) => value + 1);
whenUnion.call({ minimum: 0 }, 1);
// @ts-expect-error a shorter callback union member cannot erase the required input
whenUnion.call({ minimum: 0 });
// @ts-expect-error a receiver-free callback union member cannot erase another receiver
whenUnion(1);
declare const invalidUnaryUnion: (() => boolean) | ((value: number, label: string) => boolean);
// @ts-expect-error every possible callback must accept exactly one forwarded argument
whenAsync(invalidUnaryUnion, (value: number) => value);
// @ts-expect-error every possible transform must accept exactly one forwarded argument
whenAsync((value: number) => value, invalidUnaryUnion);
declare const structuralTransform:
  | ((this: { title: string }, value: { active: boolean }) => string)
  | ((this: { minimum: number }, value: { verified: boolean }) => Promise<number>);
const whenStructuralUnion = whenAsync(() => true, structuralTransform);
whenStructuralUnion.call({ title: 'x', minimum: 0 }, { active: true, verified: true });
// @ts-expect-error every transform union member's input must be safe
whenStructuralUnion.call({ title: 'x', minimum: 0 }, { active: true });
// @ts-expect-error every transform union member's receiver must be safe
whenStructuralUnion.call({ title: 'x' }, { active: true, verified: true });

// An awaited guard does not narrow branch inputs; narrower callbacks constrain the wrapper instead.
const isString = (value: string | null): value is string => value !== null;
const guardedWhen = whenAsync(isString, (value) => {
  // @ts-expect-error an async conditional does not supply type guard narrowing
  value.toUpperCase();
  return value;
});
guardedWhen(null);
const independentlySafeWhen = whenAsync(isString, (value: string) => value.toUpperCase());
independentlySafeWhen('x');
// @ts-expect-error null is not independently safe for the transform
independentlySafeWhen(null);

const choice = ifElseAsync(
  (value: number, label: string) => Promise.resolve(value && label),
  (value, label) => Promise.resolve(label + value.toFixed()),
  (value, label) => value + label.length
);
const choiceResult: Promise<string | number> = choice(1, 'one');
type ChoiceResult = Assert<Equal<ReturnType<typeof choice>, Promise<string | number>>>;
// @ts-expect-error all required inputs remain required
choice(1);
// @ts-expect-error each argument retains its type
choice(1, 2);
const customChoice = ifElseAsync(
  () => unknownResult,
  () => thenable,
  () => Promise.resolve(1)
);
type CustomChoice = Assert<Equal<ReturnType<typeof customChoice>, Promise<string | number>>>;
const unknownChoice = ifElseAsync(
  () => thenable,
  () => unknownResult,
  () => 1
);
type UnknownChoice = Assert<Equal<ReturnType<typeof unknownChoice>, Promise<unknown>>>;
// prettier-ignore
// @ts-expect-error both branches are required
ifElseAsync(() => true, () => 1);
// prettier-ignore
// @ts-expect-error null is not a predicate
ifElseAsync(null, () => 1, () => 0);
// prettier-ignore
// @ts-expect-error undefined is not a branch
ifElseAsync(() => true, undefined, () => 0);
// prettier-ignore
// @ts-expect-error a promise is not a branch callback
ifElseAsync(() => true, () => 1, Promise.resolve(0));
const mixedChoice = ifElseAsync(
  () => true,
  (value: number) => value,
  (value: number, label: string) => label + value
);
mixedChoice(1, 'one');
// @ts-expect-error ignored arguments cannot erase the longer branch's required argument
mixedChoice(1);
const optionalChoice = ifElseAsync(
  (value?: number) => value,
  () => 0,
  (value?: number) => value
);
optionalChoice();
optionalChoice(1);
const requiredChoice = ifElseAsync(
  (value?: number) => value,
  () => 0,
  (value: number) => value
);
requiredChoice(1);
// @ts-expect-error optional callbacks cannot erase a branch's required input
requiredChoice();
const variadicChoice = ifElseAsync(
  (name: string, first: number, ...values: number[]) => name && first && values.length,
  () => 'yes',
  (name: string, first: number, ...values: number[]) => first + values.length
);
variadicChoice('n', 1, 2, 3);
// @ts-expect-error mandatory arguments before a rest remain required
variadicChoice('n');
// @ts-expect-error rest arguments retain their element type
variadicChoice('n', 1, 'two');
const choiceReceiver = ifElseAsync(
  function (this: { enabled: boolean }, value: number) {
    return this.enabled && value;
  },
  function (this: { prefix: string }, value: number) {
    return Promise.resolve(this.prefix + value);
  },
  function (this: { minimum: number }, value: number) {
    return value - this.minimum;
  }
);
choiceReceiver.call({ enabled: true, prefix: 'x', minimum: 0 }, 1);
// @ts-expect-error every possibly reached callback contributes its receiver requirement
choiceReceiver.call({ enabled: true, prefix: 'x' }, 1);
// @ts-expect-error callback receiver requirements cannot be omitted
choiceReceiver(1);
const unionChoice = ifElseAsync(unaryUnion, () => false, structuralTransform);
unionChoice.call({ minimum: 0, title: 'x' }, 1 as number & { active: boolean; verified: boolean });
// @ts-expect-error every callback union alternative contributes required arguments
unionChoice.call({ minimum: 0, title: 'x' });
// @ts-expect-error every callback union alternative contributes its receiver
unionChoice(1 as number & { active: boolean; verified: boolean });
declare const mixedBranch:
  (() => string) | ((this: { prefix: string }, value: number, label: string) => Promise<number>);
const mixedBranchChoice = ifElseAsync(unaryUnion, mixedBranch, () => 0);
mixedBranchChoice.call({ minimum: 0, prefix: 'x' }, 1, 'one');
type MixedBranchChoice = Assert<Equal<ReturnType<typeof mixedBranchChoice>, Promise<string | number>>>;
// @ts-expect-error the longer possible branch's required argument cannot disappear
mixedBranchChoice.call({ minimum: 0, prefix: 'x' }, 1);
// @ts-expect-error the possible branch's receiver cannot disappear
mixedBranchChoice.call({ minimum: 0 }, 1, 'one');
const guardChoice = ifElseAsync(
  isString,
  (value) => {
    // @ts-expect-error the true branch receives no async guard narrowing
    value.toUpperCase();
    return value;
  },
  (value) => {
    // @ts-expect-error the false branch receives no complement narrowing
    const onlyNull: null = value;
    return value;
  }
);
guardChoice(null);
const independentlySafeChoice = ifElseAsync(
  isString,
  (value: string) => value.toUpperCase(),
  () => 'no'
);
independentlySafeChoice('x');
// @ts-expect-error null cannot be passed to a possibly selected string-only branch
independentlySafeChoice(null);

for (const factory of [norAsync, xorAsync]) {
  const combined = factory(
    (value: number, label?: string) => value && label,
    () => thenable,
    () => unknownResult,
    null,
    undefined
  );
  combined(1);
  combined(1, 'one');
  type CombinedResult = Assert<Equal<ReturnType<typeof combined>, Promise<boolean>>>;
  // @ts-expect-error predicates always return promises
  const syncResult: boolean = combined(1);
  // @ts-expect-error a required argument cannot vanish
  combined();
  // @ts-expect-error required argument types remain enforced
  combined('one');
  // @ts-expect-error optional argument types remain enforced
  combined(1, 2);
  const empty: Promise<boolean> = factory()();
  const nullish: Promise<boolean> = factory(null, undefined)('unused');
  // @ts-expect-error configured non-functions are invalid
  factory(1);
  // @ts-expect-error configured promises are invalid
  factory(Promise.resolve(true));
  const mixed = factory(
    () => true,
    (value: number) => value,
    (value: number, label: string) => Promise.resolve(label)
  );
  mixed(1, 'one');
  // @ts-expect-error shorter callbacks cannot erase the longest required argument list
  mixed(1);
  const rest = factory(
    (name: string, first: number, ...values: number[]) => values,
    () => false
  );
  rest('n', 1, 2, 3);
  // @ts-expect-error rest element types remain enforced
  rest('n', 1, 'two');
  // @ts-expect-error required inputs before a rest remain required
  rest('n');
  const union = factory(unaryUnion, mixedBranch);
  union.call({ minimum: 0, prefix: 'x' }, 1, 'one');
  // @ts-expect-error callback unions retain required inputs
  union.call({ minimum: 0, prefix: 'x' }, 1);
  // @ts-expect-error callback unions retain receivers even alongside receiver-free alternatives
  union(1, 'one');
  const optional: ((this: { prefix: string }, value: { active: boolean }) => unknown) | undefined =
    Math.random() > 0.5
      ? function (value) {
          return this.prefix && value.active;
        }
      : undefined;
  const nullable: ((this: { minimum: number }, value: { verified: boolean }) => Promise<boolean>) | null =
    Math.random() > 0.5
      ? function (value) {
          return Promise.resolve(this.minimum > 0 && value.verified);
        }
      : null;
  const maybe = factory(() => false, optional, nullable);
  maybe.call({ prefix: 'x', minimum: 0 }, { active: true, verified: true });
  // @ts-expect-error every possibly present predicate contributes its required input
  maybe.call({ prefix: 'x', minimum: 0 }, { active: true });
  // @ts-expect-error every possibly present predicate contributes its receiver
  maybe.call({ prefix: 'x' }, { active: true, verified: true });
  const dynamicPredicates: (typeof optional | typeof nullable)[] = [];
  const dynamic = factory(...dynamicPredicates);
  dynamic.call({ prefix: 'x', minimum: 0 }, { active: true, verified: true });
  // @ts-expect-error dynamic lists retain all possible input requirements
  dynamic.call({ prefix: 'x', minimum: 0 }, { verified: true });
  // @ts-expect-error dynamic lists retain all possible receiver requirements
  dynamic({ active: true, verified: true });
  const impossible = factory(
    (value: number) => value,
    (value: string) => value
  );
  // @ts-expect-error number cannot satisfy both callback input types
  impossible(1);
  // @ts-expect-error string cannot satisfy both callback input types
  impossible('one');
  const guard = factory(isString);
  type GuardResult = Assert<Equal<ReturnType<typeof guard>, Promise<boolean>>>;
  // @ts-expect-error asynchronous predicates do not promise synchronous narrowing
  const narrowingGuard: (value: string | null) => value is string = guard;
}

// whenAsync supplies one explicit undefined when omitted; ifElseAsync forwards zero arguments.
const explicitUndefinedWhen = whenAsync(
  (value: number | undefined) => value,
  () => 0
);
explicitUndefinedWhen(undefined);
explicitUndefinedWhen();
const explicitUndefinedChoice = ifElseAsync(
  (value: number | undefined) => value,
  () => 1,
  () => 0
);
explicitUndefinedChoice(undefined);
// @ts-expect-error required input positions remain required
explicitUndefinedChoice();

const promisedChoice = ifElseAsync(
  (value: PromiseLike<number>, label: string) => value.then((number) => number && label),
  (value, label) => value.then((number) => label + number),
  (value, label) => value.then((number) => number + label.length)
);
promisedChoice(Promise.resolve(1), 'one');
type PromisedChoice = Assert<Equal<ReturnType<typeof promisedChoice>, Promise<string | number>>>;
// @ts-expect-error original arguments reach callbacks before awaiting their returned values
promisedChoice(1, 'one');

// Default-import named exports retain the full factory types.
type DefaultWhenNamed = Assert<Equal<typeof api.whenAsync, typeof whenAsync>>;
type DefaultIfElseNamed = Assert<Equal<typeof api.ifElseAsync, typeof ifElseAsync>>;
type DefaultNorNamed = Assert<Equal<typeof api.norAsync, typeof norAsync>>;
type DefaultXorNamed = Assert<Equal<typeof api.xorAsync, typeof xorAsync>>;

// A union of call tuples belongs to one callback: only one-argument alternatives are forwarded.
const zeroOrNumber = (...args: [] | [value: number]) => args.length === 0 || args[0].toFixed() === '1';
const zeroOrNumberWhen = whenAsync(zeroOrNumber, () => 'selected');
zeroOrNumberWhen(1);
// @ts-expect-error an empty tuple does not permit the one explicit undefined forwarded by whenAsync
zeroOrNumberWhen();
// @ts-expect-error undefined is not accepted by the one-argument alternative
zeroOrNumberWhen(undefined);
const zeroOrNumberTransform = whenAsync(() => true, zeroOrNumber);
zeroOrNumberTransform(1);
// @ts-expect-error transform tuple alternatives cannot turn an empty tuple into explicit undefined
zeroOrNumberTransform();
// @ts-expect-error the transform's one-argument alternative requires a number
zeroOrNumberTransform(undefined);

const stringOrNumber = (...args: [value: string] | [value: number]) => !!args[0];
const stringOrNumberWhen = whenAsync(stringOrNumber, (value) => {
  type ContextualTupleInput = Assert<Equal<typeof value, string | number>>;
  return Boolean(value);
});
stringOrNumberWhen('one');
stringOrNumberWhen(1);
type TupleUnionWhenResult = Assert<Equal<ReturnType<typeof stringOrNumberWhen>, Promise<string | number | boolean>>>;
// @ts-expect-error the input must match a declared one-argument call shape
stringOrNumberWhen(true);
// @ts-expect-error neither one-argument call shape accepts undefined
stringOrNumberWhen();
const stringOrNumberTransform = whenAsync(() => true, stringOrNumber);
stringOrNumberTransform('one');
stringOrNumberTransform(1);
// @ts-expect-error transform call alternatives do not permit unrelated inputs
stringOrNumberTransform(true);

const oneOrTwo = (...args: [value: number] | [value: number, label: string]) => args[0] > 0;
whenAsync(oneOrTwo, () => false)(1);
whenAsync(() => true, oneOrTwo)(1);
const zeroOrTwo = (...args: [] | [value: number, label: string]) => args.length === 0 || args[0] > 0;
// @ts-expect-error no alternative accepts exactly one forwarded argument
whenAsync(zeroOrTwo, () => false);
// @ts-expect-error no transform alternative accepts exactly one forwarded argument
whenAsync(() => true, zeroOrTwo);

const numberOrTwoStrings = (...args: [value: number] | [value: string, label: string]) => !!args[0];
const onlyNumberWhen = whenAsync(numberOrTwoStrings, () => false);
onlyNumberWhen(1);
// @ts-expect-error the string input belongs only to a two-argument call shape
onlyNumberWhen('one');
const onlyNumberTransform = whenAsync(() => true, numberOrTwoStrings);
onlyNumberTransform(1);
// @ts-expect-error the transform's string input requires an unavailable second argument
onlyNumberTransform('one');

// Tuple alternatives remain alternatives within each possible callback; separate callbacks intersect.
declare const tupleCallbackUnion:
  | ((this: { prefix: string }, ...args: [value: string] | [value: number]) => boolean)
  | ((this: { minimum: number }, value: number) => Promise<boolean>);
const tupleCallbackWhen = whenAsync(tupleCallbackUnion, () => false);
tupleCallbackWhen.call({ prefix: 'x', minimum: 0 }, 1);
// @ts-expect-error the numeric callback alternative must also accept the input
tupleCallbackWhen.call({ prefix: 'x', minimum: 0 }, 'one');
// @ts-expect-error every possible callback retains its receiver requirement
tupleCallbackWhen.call({ prefix: 'x' }, 1);
const tupleCallbackTransform = whenAsync(() => true, tupleCallbackUnion);
tupleCallbackTransform.call({ prefix: 'x', minimum: 0 }, 1);
// @ts-expect-error every possible transform must accept the input
tupleCallbackTransform.call({ prefix: 'x', minimum: 0 }, 'one');
// @ts-expect-error every possible transform retains its receiver requirement
tupleCallbackTransform.call({ minimum: 0 }, 1);

// An explicit union of argument tuples constrains the complete forwarded call shape.
const tupleChoice = ifElseAsync(
  zeroOrNumber,
  () => 1,
  () => 0
);
tupleChoice();
tupleChoice(1);
// @ts-expect-error no tuple alternative accepts a string
tupleChoice('unsafe');
// @ts-expect-error zero arguments and one explicit undefined are different call shapes
tupleChoice(undefined);
const tupleBranchChoice = ifElseAsync(
  () => true,
  zeroOrNumber,
  () => false
);
tupleBranchChoice();
tupleBranchChoice(1);
// @ts-expect-error branch tuple alternatives retain their input types
tupleBranchChoice('unsafe');
// @ts-expect-error an empty branch tuple does not accept one explicit undefined
tupleBranchChoice(undefined);
const correlatedArguments = (...args: [value: number, label: string] | [value: string, label: number]) =>
  !!args[0] && !!args[1];
const correlatedChoice = ifElseAsync(
  correlatedArguments,
  () => 1,
  () => 0
);
correlatedChoice(1, 'one');
correlatedChoice('one', 1);
// @ts-expect-error the accepted tuples correlate their first and second argument types
correlatedChoice(1, 1);
// @ts-expect-error tuple alternatives do not permit unrelated argument pairs
correlatedChoice('one', 'one');

for (const factory of [norAsync, xorAsync]) {
  const tuplePredicate = factory(zeroOrNumber, () => false);
  tuplePredicate();
  tuplePredicate(1);
  // @ts-expect-error a no-argument tuple alternative cannot erase the numeric argument alternative
  tuplePredicate('unsafe');
  // @ts-expect-error an empty tuple does not mean one explicit undefined is accepted
  tuplePredicate(undefined);
  const correlatedPredicate = factory(() => false, correlatedArguments);
  correlatedPredicate(1, 'one');
  correlatedPredicate('one', 1);
  // @ts-expect-error complete tuple alternatives retain the relationship between argument types
  correlatedPredicate(1, 1);
  // @ts-expect-error complete tuple alternatives cannot be mixed position by position
  correlatedPredicate('one', 'one');
}

const oneStringOrTwoNumbers = (...args: [value: string] | [value: number, radix: number]) =>
  args.length === 1 ? args[0].toUpperCase() : args[0].toFixed(args[1]);
const twoArgumentStringCallback = (value: string, radix: number) => value.length > radix;
const stringOrNumericPairChoice = ifElseAsync(
  oneStringOrTwoNumbers,
  () => 1,
  () => 0
);
stringOrNumericPairChoice('one');
stringOrNumericPairChoice(1, 2);
// @ts-expect-error string belongs only to the one-argument call shape
stringOrNumericPairChoice('unsafe', 2);

for (const factory of [norAsync, xorAsync]) {
  const heterogeneousTuples = factory(oneStringOrTwoNumbers, twoArgumentStringCallback);
  // @ts-expect-error one callback requires two arguments, but the other accepts strings only when called with one
  heterogeneousTuples('unsafe', 2);
  // @ts-expect-error a numeric pair is not accepted by the separate string callback
  heterogeneousTuples(1, 2);
  const optionalTupleCallback: typeof oneStringOrTwoNumbers | undefined =
    Math.random() > 0.5 ? oneStringOrTwoNumbers : undefined;
  const nullableTupleCallback: typeof oneStringOrTwoNumbers | null = Math.random() > 0.5 ? oneStringOrTwoNumbers : null;
  const optionalTuples = factory(() => false, optionalTupleCallback, nullableTupleCallback);
  optionalTuples('one');
  optionalTuples(1, 2);
  // @ts-expect-error possibly present predicates retain complete tuple alternatives
  optionalTuples('unsafe', 2);
  // @ts-expect-error numeric inputs require the second argument
  optionalTuples(1);
  const dynamicTupleCallbacks: (typeof oneStringOrTwoNumbers | null | undefined)[] = [];
  const dynamicTuples = factory(...dynamicTupleCallbacks);
  dynamicTuples('one');
  dynamicTuples(1, 2);
  // @ts-expect-error dynamic predicates retain correlations between argument types and arity
  dynamicTuples('unsafe', 2);
  // @ts-expect-error an optional callback's argument requirements cannot vanish in a dynamic list
  dynamicTuples(1);
}

// A suffix-only variadic can still have a valid one-argument call.
const trailingNumber = (...args: [...labels: string[], value: number]) => args.length > 0;
const trailingNumberWhen = whenAsync(trailingNumber, () => false);
trailingNumberWhen(1);
// @ts-expect-error a string can precede the suffix but cannot replace the required numeric suffix
trailingNumberWhen('one');
const trailingNumberTransform = whenAsync(() => true, trailingNumber);
trailingNumberTransform(1);
// @ts-expect-error the transform's only forwarded value must satisfy its mandatory suffix
trailingNumberTransform('one');

// A contextually inferred predicate cannot erase an annotated transform's contract.
const inferredStringWhen = whenAsync(
  (value) => value != null,
  (value: string) => value.toUpperCase()
);
inferredStringWhen('hello');
type InferredStringWhen = Assert<Equal<ReturnType<typeof inferredStringWhen>, Promise<string>>>;
// @ts-expect-error the transform requires a string
inferredStringWhen(123);
// @ts-expect-error the transform requires an input
inferredStringWhen();
// @ts-expect-error the awaited result is a string, not an unconstrained value
const inferredStringWrongResult: Promise<number> = inferredStringWhen('hello');
const inferredDefaultWhen = api.whenAsync(
  (value) => value != null,
  (value: string) => value.toUpperCase()
);
// @ts-expect-error the default-object export retains the transform's input
inferredDefaultWhen(123);
type InferredDefaultWhen = Assert<Equal<ReturnType<typeof inferredDefaultWhen>, Promise<string>>>;
const inferredNumericWhen = whenAsync(
  (value: number) => value > 0,
  (value) => value + 1
);
type InferredNumericWhen = Assert<Equal<ReturnType<typeof inferredNumericWhen>, Promise<number>>>;
const ignoredPredicateWhen = whenAsync(
  () => true,
  (value: number) => value + 1
);
ignoredPredicateWhen(1);
// @ts-expect-error an ignored predicate input cannot erase the transform's input
ignoredPredicateWhen();
type IgnoredPredicateWhen = Assert<Equal<ReturnType<typeof ignoredPredicateWhen>, Promise<number>>>;
const explicitUnknownWhen = whenAsync(
  (value: unknown) => value != null,
  (value: string) => value.toUpperCase()
);
type ExplicitUnknownWhen = Assert<Equal<ReturnType<typeof explicitUnknownWhen>, Promise<string>>>;
const anyPredicateWhen = whenAsync(
  (value: any) => value != null,
  (value: string) => value.toUpperCase()
);
// @ts-expect-error even an explicit any predicate cannot erase a concrete transform requirement
anyPredicateWhen(123);
type AnyPredicateWhen = Assert<Equal<ReturnType<typeof anyPredicateWhen>, Promise<string>>>;

const inferredAwaitedWhen = whenAsync(
  (value) => value != null,
  (value: string) => Promise.resolve(value.length)
);
type InferredAwaitedWhen = Assert<Equal<ReturnType<typeof inferredAwaitedWhen>, Promise<string | number>>>;
const inferredOptionalWhen = whenAsync(
  (value) => value != null,
  (value?: number) => value ?? 0
);
inferredOptionalWhen();
inferredOptionalWhen(1);
type InferredOptionalWhen = Assert<Equal<ReturnType<typeof inferredOptionalWhen>, Promise<number | undefined>>>;
// @ts-expect-error the optional transform still restricts supplied inputs
inferredOptionalWhen('one');

const inferredWhenReceiver = whenAsync(
  function (this: { enabled: boolean }, value: number) {
    return this.enabled && value;
  },
  (value) => value + 1
);
inferredWhenReceiver.call({ enabled: true }, 1);
// @ts-expect-error the inferred transform cannot erase the predicate's receiver
inferredWhenReceiver(1);
const inferredIfElseReceiver = ifElseAsync(
  function (this: { enabled: boolean }, value: number) {
    return this.enabled && value;
  },
  (value) => value + 1,
  (value) => value - 1
);
inferredIfElseReceiver.call({ enabled: true }, 1);
// @ts-expect-error the inferred branches cannot erase the predicate's receiver
inferredIfElseReceiver(1);

const norAsyncExplicitCallback = norAsync<(this: { minimum: number }, value: number) => boolean, []>(function (value) {
  return value > this.minimum;
});
norAsyncExplicitCallback.call({ minimum: 0 }, 1);
// @ts-expect-error explicit callback type arguments retain the required receiver
norAsyncExplicitCallback(1);
// @ts-expect-error explicit callback type arguments retain the input type
norAsyncExplicitCallback.call({ minimum: 0 }, 'one');

const xorAsyncExplicitCallback = xorAsync<(this: { minimum: number }, value: number) => boolean, []>(function (value) {
  return value > this.minimum;
});
xorAsyncExplicitCallback.call({ minimum: 0 }, 1);
// @ts-expect-error explicit callback type arguments retain the required receiver
xorAsyncExplicitCallback(1);
// @ts-expect-error explicit callback type arguments retain the input type
xorAsyncExplicitCallback.call({ minimum: 0 }, 'one');

// Annotated branches must also protect operations inside inferred predicates.
const predicateFromTransform = whenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error the inferred string input has no numeric formatting method
    value.toFixed(0);
    // @ts-expect-error unknown members must not be permitted through contextual any
    value.missingMember();
    return value.toUpperCase() === 'HELLO';
  },
  (value: string) => value.toUpperCase()
);
predicateFromTransform('hello');
type PredicateFromTransform = Assert<Equal<ReturnType<typeof predicateFromTransform>, Promise<string>>>;
const predicateFromBranches = ifElseAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error the inferred string input has no numeric formatting method
    value.toFixed(0);
    // @ts-expect-error unknown members must not be permitted through contextual any
    value.missingMember();
    return value.toUpperCase() === 'HELLO';
  },
  (value: string) => value.toUpperCase(),
  (value: string) => value.toLowerCase()
);
predicateFromBranches('hello');
type PredicateFromBranches = Assert<Equal<ReturnType<typeof predicateFromBranches>, Promise<string>>>;
const optionalPredicateInput = whenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, number | undefined>>;
    // @ts-expect-error optional numeric inputs do not gain string methods
    value?.toUpperCase();
    return value?.toFixed() === '1';
  },
  (value?: number) => value ?? 0
);
optionalPredicateInput();
optionalPredicateInput(1);
type OptionalPredicateInput = Assert<Equal<ReturnType<typeof optionalPredicateInput>, Promise<number | undefined>>>;
const optionalBranchInput = ifElseAsync(
  (value?) => {
    type PredicateInput = Assert<Equal<typeof value, number | undefined>>;
    // @ts-expect-error optional numeric inputs do not gain string methods
    value?.toUpperCase();
    return value?.toFixed() === '1';
  },
  (value?: number) => value ?? 0,
  (value?: number) => value?.toFixed()
);
optionalBranchInput();
optionalBranchInput(1);
type OptionalBranchInput = Assert<Equal<ReturnType<typeof optionalBranchInput>, Promise<number | string | undefined>>>;

const inferredWhenEntry0 = whenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase()
);
inferredWhenEntry0('hello');

const inferredWhenEntry1 = deepWhenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase()
);
inferredWhenEntry1('hello');

const inferredWhenEntry3 = api.whenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase()
);
inferredWhenEntry3('hello');

const inferredChoiceEntry0 = ifElseAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase(),
  (value: string) => value.toLowerCase()
);
inferredChoiceEntry0('hello');

const inferredChoiceEntry1 = deepIfElseAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase(),
  (value: string) => value.toLowerCase()
);
inferredChoiceEntry1('hello');

const inferredChoiceEntry3 = api.ifElseAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    // @ts-expect-error all entry points contextually type the predicate body
    value.toFixed(0);
    return value.length > 0;
  },
  (value: string) => value.toUpperCase(),
  (value: string) => value.toLowerCase()
);
inferredChoiceEntry3('hello');

// No annotations means a safe unknown context, not implicit permission to use any member.
const unknownWhenInput = whenAsync(
  (value) => {
    type UnconstrainedInput = Assert<Equal<typeof value, unknown>>;
    // @ts-expect-error inspect or annotate an unknown input before accessing members
    value.missingMember();
    return Boolean(value);
  },
  (value) => value
);
unknownWhenInput('hello');
const unknownChoiceInput = ifElseAsync(
  (value) => {
    type UnconstrainedInput = Assert<Equal<typeof value, unknown>>;
    // @ts-expect-error inspect or annotate an unknown input before accessing members
    value.missingMember();
    return Boolean(value);
  },
  (value) => value,
  (value) => value
);
unknownChoiceInput('hello');
const distinctInferredArguments = ifElseAsync(
  (value, label) => {
    type NumericInput = Assert<Equal<typeof value, number>>;
    type TextInput = Assert<Equal<typeof label, string>>;
    // @ts-expect-error the second argument retains its own string type
    label.toFixed();
    return value.toFixed() === label.toUpperCase();
  },
  (value: number, label: string) => label + value,
  (value: number, label: string) => value + label.length
);
type DistinctInferredArguments = Assert<Equal<ReturnType<typeof distinctInferredArguments>, Promise<number | string>>>;
distinctInferredArguments(1, 'one');
// @ts-expect-error argument positions remain distinct on the returned wrapper
distinctInferredArguments(1, 2);
const predicateReceiverFromTransform = whenAsync(
  function (value) {
    type ContextualReceiver = Assert<Equal<0 extends 1 & typeof this ? true : false, false>>;
    const enabled: boolean = this.enabled;
    // @ts-expect-error the annotated transform supplies the predicate's receiver context
    this.missingMember();
    return enabled && value.length > 0;
  },
  function (this: { enabled: boolean }, value: string) {
    return value.toUpperCase();
  }
);
predicateReceiverFromTransform.call({ enabled: true }, 'hello');
// @ts-expect-error contextual inference preserves the required receiver
predicateReceiverFromTransform('hello');
const predicateReceiverFromBranches = ifElseAsync(
  function (value) {
    type ContextualReceiver = Assert<Equal<0 extends 1 & typeof this ? true : false, false>>;
    const enabled: boolean = this.enabled;
    // @ts-expect-error the annotated branches supply the predicate's receiver context
    this.missingMember();
    return enabled && value.length > 0;
  },
  function (this: { enabled: boolean }, value: string) {
    return value.toUpperCase();
  },
  function (this: { enabled: boolean }, value: string) {
    return value.toLowerCase();
  }
);
predicateReceiverFromBranches.call({ enabled: true }, 'hello');
// @ts-expect-error contextual inference preserves the required receiver
predicateReceiverFromBranches('hello');

// Incompatible callback shapes must not regain permissive contexts through a fallback.
declare const heterogeneousTransform:
  ((value: { active: boolean }) => string) | ((value: { verified: boolean }) => number);
whenAsync((value) => {
  type NotAny = Assert<Equal<0 extends 1 & typeof value ? true : false, false>>;
  // @ts-expect-error annotate an input when the callbacks have no shared contextual signature
  return value.missingMember();
}, heterogeneousTransform);
const annotatedHeterogeneousWhen = whenAsync((value: unknown) => Boolean(value), heterogeneousTransform);
annotatedHeterogeneousWhen({ active: true, verified: true });
ifElseAsync(
  (value) => {
    type NotAny = Assert<Equal<0 extends 1 & typeof value ? true : false, false>>;
    // @ts-expect-error incompatible branch shapes cannot silently supply any
    return value.missingMember();
  },
  (value: { active: boolean }) => value.active,
  (value: { verified: boolean }) => value.verified
);
const annotatedHeterogeneousChoice = ifElseAsync(
  (value: unknown) => Boolean(value),
  (value: { active: boolean }) => value.active,
  (value: { verified: boolean }) => value.verified
);
annotatedHeterogeneousChoice({ active: true, verified: true });
declare const heterogeneousPredicate:
  | ((this: { enabled: boolean }, value: { active: boolean }) => boolean)
  | ((this: { allowed: boolean }, value: { verified: boolean }) => boolean);
whenAsync(heterogeneousPredicate, function (value) {
  // @ts-expect-error a fallback without a shared receiver requires an explicit this annotation
  return this.missingMember() || value;
});
ifElseAsync(
  heterogeneousPredicate,
  function (value) {
    // @ts-expect-error a fallback without a shared receiver requires an explicit this annotation
    return this.missingMember() || value;
  },
  (value) => value
);
const explicitWhenTypes = whenAsync<(value: string) => boolean, (value: string) => string>(
  (value) => {
    // @ts-expect-error explicit callback type arguments still contextually check the body
    value.toFixed();
    return value.length > 0;
  },
  (value) => value.toUpperCase()
);
explicitWhenTypes('hello');
const explicitChoiceTypes = ifElseAsync<
  (value: string) => boolean,
  (value: string) => string,
  (value: string) => number
>(
  (value) => {
    // @ts-expect-error explicit callback type arguments still contextually check the body
    value.toFixed();
    return value.length > 0;
  },
  (value) => value.toUpperCase(),
  (value) => value.length
);
explicitChoiceTypes('hello');
type ExplicitWhenTypes = Assert<Equal<ReturnType<typeof explicitWhenTypes>, Promise<string>>>;
type ExplicitChoiceTypes = Assert<Equal<ReturnType<typeof explicitChoiceTypes>, Promise<string | number>>>;

// Ignored arguments must not win inference over a later branch's concrete input.
const contextFromFalseBranch = ifElseAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    return value.toUpperCase() === 'X';
  },
  () => 0,
  (value: string) => value.length
);
contextFromFalseBranch('x');
// @ts-expect-error the false branch still requires a string
contextFromFalseBranch();
const contextFromTupleTransform = whenAsync(
  (value) => {
    type PredicateInput = Assert<Equal<typeof value, string>>;
    return value.toUpperCase() === 'X';
  },
  (...args: [] | [text: string]) => (args.length ? args[0].length : 0)
);
contextFromTupleTransform('x');
type ContextFromTupleTransform = Assert<Equal<ReturnType<typeof contextFromTupleTransform>, Promise<string | number>>>;
// @ts-expect-error whenAsync always forwards one argument, so the empty tuple is not available
contextFromTupleTransform();
const contextFromTupleBranch = ifElseAsync(
  (...args) => args.length === 0 || args[0].toUpperCase() === 'X',
  () => 0,
  (...args: [] | [text: string]) => (args.length ? args[0].length : 0)
);
contextFromTupleBranch();
contextFromTupleBranch('x');
// @ts-expect-error an empty tuple is not an explicit undefined argument
contextFromTupleBranch(undefined);
// @ts-expect-error tuple alternatives still reject incompatible inputs
contextFromTupleBranch(123);
const contextFromStructuralBranches = ifElseAsync(
  (value) => value.active && value.verified,
  (value: { active: boolean }) => value.active,
  (value: { verified: boolean }) => value.verified
);
contextFromStructuralBranches({ active: true, verified: true });
// @ts-expect-error both possible branch requirements remain required
contextFromStructuralBranches({ active: true });
