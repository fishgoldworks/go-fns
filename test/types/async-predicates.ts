import api, { and, andAsync, not, notAsync, or, orAsync, nor, norAsync, xor, xorAsync } from '../../index';
import deepNotAsync = require('../../src/logic/notAsync');
import deepAndAsync = require('../../src/logic/andAsync');
import deepOrAsync = require('../../src/logic/orAsync');

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// Focused imports expose the full factory type, including all overloads.
type DeepNot = Assert<Equal<typeof deepNotAsync, typeof notAsync>>;
type DeepAnd = Assert<Equal<typeof deepAndAsync, typeof andAsync>>;
type DeepOr = Assert<Equal<typeof deepOrAsync, typeof orAsync>>;
const defaultNot: typeof notAsync = api.notAsync;
const defaultAnd: typeof andAsync = api.andAsync;
const defaultOr: typeof orAsync = api.orAsync;

// A plain value, promise, custom thenable or unknown outcome is accepted.
declare const thenable: PromiseLike<string>;
declare const unknownResult: unknown;
const negated = notAsync((value: number, label?: string) => value && label);
const negatedResult: Promise<boolean> = negated(1, 'one');

negated(0);
type NegatedResult = Assert<Equal<ReturnType<typeof negated>, Promise<boolean>>>;
// @ts-expect-error the callback still requires a numeric first argument
negated('one');
// @ts-expect-error the callback still requires its first argument
negated();
// @ts-expect-error an optional argument retains its own type
negated(1, 2);
notAsync(() => thenable)();
notAsync(() => unknownResult)();
notAsync(() => Promise.resolve(0))();
// @ts-expect-error notAsync requires a callback
notAsync();
// @ts-expect-error null is not a callback
notAsync(null);
// @ts-expect-error undefined is not a callback
notAsync(undefined);
// @ts-expect-error a promise is not a callback
notAsync(Promise.resolve(true));

const negateWithThis = notAsync(function (this: { minimum: number }, value: number, ...labels: string[]) {
  return Promise.resolve(value > this.minimum && labels.length);
});
const negateWithThisResult: Promise<boolean> = negateWithThis.call({ minimum: 1 }, 2, 'yes');

// @ts-expect-error a required receiver cannot be omitted
negateWithThis(2);
// @ts-expect-error the receiver retains its required field
negateWithThis.call({}, 2);
// @ts-expect-error rest arguments retain their element type
negateWithThis.call({ minimum: 1 }, 2, 3);

// A shorter possible callback may ignore arguments required by another union member.
declare const mixedArityCallback: (() => boolean) | ((value: number) => Promise<boolean>);
const negateMixedArity = notAsync(mixedArityCallback);
const mixedArityResult: Promise<boolean> = negateMixedArity(1);

type MixedArityResult = Assert<Equal<ReturnType<typeof negateMixedArity>, Promise<boolean>>>;
// @ts-expect-error the zero-argument branch cannot erase the numeric branch's required input
negateMixedArity();
// @ts-expect-error a shorter branch cannot erase another branch's argument type
negateMixedArity('one');

declare const mixedArityReceivers:
  | ((this: { enabled: boolean }) => boolean)
  | ((this: { minimum: number }, value: number, label: string) => PromiseLike<boolean>);
const negateMixedReceivers = notAsync(mixedArityReceivers);

negateMixedReceivers.call({ enabled: true, minimum: 0 }, 1, 'one');
// @ts-expect-error the shorter branch's receiver is still required
negateMixedReceivers.call({ minimum: 0 }, 1, 'one');
// @ts-expect-error the longer branch's receiver is still required
negateMixedReceivers.call({ enabled: true }, 1, 'one');
// @ts-expect-error all arguments required by the longer branch must be supplied
negateMixedReceivers.call({ enabled: true, minimum: 0 }, 1);
// @ts-expect-error the longer branch's argument types are retained
negateMixedReceivers.call({ enabled: true, minimum: 0 }, 1, 2);
// @ts-expect-error mixed arities cannot remove the required receiver
negateMixedReceivers(1, 'one');

// Every possible callback in a union must accept the arguments and receiver.
const unionInput = Math.random() > 0.5 ? (value: number) => value : (value: string) => Promise.resolve(value);
const negateUnion = notAsync(unionInput);

// @ts-expect-error the selected callback might require a string
negateUnion(1);
// @ts-expect-error the selected callback might require a number
negateUnion('one');
const structuralUnion =
  Math.random() > 0.5
    ? function (this: { minimum: number }, value: { active: boolean }) {
        return this.minimum && value.active;
      }
    : function (this: { label: string }, value: { verified: boolean }) {
        return Promise.resolve(this.label && value.verified);
      };

const negateStructuralUnion = notAsync(structuralUnion);

negateStructuralUnion.call({ minimum: 1, label: 'yes' }, { active: true, verified: true });
// @ts-expect-error both possible input requirements remain enforced
negateStructuralUnion.call({ minimum: 1, label: 'yes' }, { active: true });
// @ts-expect-error both possible receiver requirements remain enforced
negateStructuralUnion.call({ minimum: 1 }, { active: true, verified: true });
const receiverUnion =
  Math.random() > 0.5
    ? function (this: { minimum: number }, value: number) {
        return value > this.minimum;
      }
    : (value: number) => Promise.resolve(value);
const negateReceiverUnion = notAsync(receiverUnion);

negateReceiverUnion.call({ minimum: 1 }, 2);
// @ts-expect-error a callback without this cannot erase another callback's receiver
negateReceiverUnion(2);

for (const factory of [andAsync, orAsync]) {
  const composed = factory(
    (value: number, label?: string) => value && label,
    (value: number, label?: string) => Promise.resolve(value && label),
    () => thenable,
    () => unknownResult,
    null,
    undefined
  );
  const result: Promise<boolean> = composed(1, 'one');

  type ComposedResult = Assert<Equal<ReturnType<typeof composed>, Promise<boolean>>>;
  // @ts-expect-error result is asynchronous even for synchronous callback values
  const syncResult: boolean = composed(1);

  // @ts-expect-error a callback requiring a number cannot receive a string
  composed('one');
  // @ts-expect-error required arguments remain required
  composed();
  const empty: Promise<boolean> = factory()('unused');
  const nullish: Promise<boolean> = factory(null, undefined)();

  // @ts-expect-error invalid configured entries are rejected
  factory(() => true, 1);
  // @ts-expect-error configured promises are not callable predicates
  factory(Promise.resolve(true));

  const incompatible = factory(
    (value: number) => value,
    (value: string) => Promise.resolve(value)
  );

  // @ts-expect-error both numeric and string callback requirements must be satisfied
  incompatible(1);
  // @ts-expect-error the numeric requirement must not disappear
  incompatible('one');

  const optional: ((this: { label: string }, value: { verified: boolean }) => PromiseLike<string>) | undefined =
    Math.random() > 0.5
      ? function (value) {
          return Promise.resolve(value.verified && this.label ? this.label : '');
        }
      : undefined;
  const withOptional = factory(function (this: { minimum: number }, value: { active: boolean }) {
    return this.minimum && value.active;
  }, optional);

  withOptional.call({ minimum: 1, label: 'yes' }, { active: true, verified: true });
  // @ts-expect-error a possibly present predicate still requires its input fields
  withOptional.call({ minimum: 1, label: 'yes' }, { active: true });
  // @ts-expect-error a possibly present predicate still requires its receiver
  withOptional.call({ minimum: 1 }, { active: true, verified: true });

  const nullable: ((this: { minimum: number }, value: { active: boolean }) => unknown) | null =
    Math.random() > 0.5
      ? function (value) {
          return this.minimum && value.active;
        }
      : null;
  const withNullable = factory(() => true, nullable);

  withNullable.call({ minimum: 1 }, { active: true });
  // @ts-expect-error a receiver-free callback does not erase an optional receiver
  withNullable({ active: true });
  // @ts-expect-error an ignored input does not erase an optional input requirement
  withNullable.call({ minimum: 1 }, {});

  const mixedArity = factory(
    () => true,
    (value: { active: boolean }) => value.active,
    (value: { verified: boolean }, limit: number) => Promise.resolve(value.verified && limit)
  );

  mixedArity({ active: true, verified: true }, 1);
  // @ts-expect-error zero-argument predicates cannot erase another predicate's second argument
  mixedArity({ active: true, verified: true });
  // @ts-expect-error every structural argument requirement remains enforced
  mixedArity({ active: true }, 1);

  const variadic = factory(
    (name: string, first: number, ...counts: number[]) => name && first && counts.length,
    (name: string, first: number, ...counts: number[]) => Promise.resolve(name && first && counts.length)
  );

  variadic('name', 1, 2, 3);
  // @ts-expect-error a required argument cannot become optional through a rest callback
  variadic('name');
  // @ts-expect-error rest callback element types remain enforced
  variadic('name', 1, 'two');

  const callbackUnion = factory(structuralUnion);

  callbackUnion.call({ minimum: 1, label: 'yes' }, { active: true, verified: true });
  // @ts-expect-error callback unions retain every receiver requirement
  callbackUnion.call({ minimum: 1 }, { active: true, verified: true });
  // @ts-expect-error callback unions retain every argument requirement
  callbackUnion.call({ minimum: 1, label: 'yes' }, { active: true });
  const conflictingUnion = factory(unionInput);

  // @ts-expect-error callback unions cannot choose just the numeric alternative
  conflictingUnion(1);
  // @ts-expect-error callback unions cannot choose just the string alternative
  conflictingUnion('one');
  const optionalReceiverUnion = factory(receiverUnion);

  optionalReceiverUnion.call({ minimum: 1 }, 2);
  // @ts-expect-error a union member without this cannot erase another receiver
  optionalReceiverUnion(2);

  const dynamicPredicates: (
    | ((this: { minimum: number }, value: { active: boolean }) => unknown)
    | ((value: { verified: boolean }) => PromiseLike<boolean>)
    | null
    | undefined
  )[] = [];
  const dynamic = factory(...dynamicPredicates);

  dynamic.call({ minimum: 1 }, { active: true, verified: true });
  // @ts-expect-error dynamic lists retain every possible argument requirement
  dynamic.call({ minimum: 1 }, { active: true });
  // @ts-expect-error dynamic lists retain every possible receiver requirement
  dynamic({ active: true, verified: true });
}

// Awaited predicates return booleans without claiming synchronous type narrowing.
const isString = (value: string | null): value is string => value !== null;
const asyncGuard = andAsync(isString);
const asyncComplement = notAsync(isString);

type GuardResult = Assert<Equal<ReturnType<typeof asyncGuard>, Promise<boolean>>>;
type ComplementResult = Assert<Equal<ReturnType<typeof asyncComplement>, Promise<boolean>>>;
// @ts-expect-error an asynchronous predicate is not a synchronous type guard
const guard: (value: string | null) => value is string = asyncGuard;

async function checkNarrowing(value: string | null): Promise<void> {
  if (await asyncGuard(value)) {
    // @ts-expect-error awaiting a boolean does not narrow the original input
    value.toUpperCase();
  }

  if (!(await asyncComplement(value))) {
    // @ts-expect-error negation does not create complement narrowing
    value.toUpperCase();
  }
}

// Explicit tuple unions are complete call alternatives, including their lengths.
const emptyOrText = (...args: [] | [text: string]) => (args.length === 0 ? true : args[0].toUpperCase() === 'X');
const negatedTupleUnion = notAsync(emptyOrText);

negatedTupleUnion();
negatedTupleUnion('X');
// @ts-expect-error explicit undefined does not match either call alternative
negatedTupleUnion(undefined);
// @ts-expect-error the empty alternative cannot admit arbitrary extra arguments
negatedTupleUnion('X', 1);
// @ts-expect-error the nonempty alternative requires a string
api.notAsync(emptyOrText)(123);

const andTupleUnion = and(emptyOrText, () => true);

andTupleUnion();
andTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
andTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
andTupleUnion('X', 1);
const andIncompatibleTuple = and((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
andIncompatibleTuple({ active: true });
const andCompatibleTuple = and((value: string) => value.length, emptyOrText);

andCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
andCompatibleTuple();
const andIgnoredInput = and(
  () => true,
  (value: number) => value
);

andIgnoredInput(1);

const orTupleUnion = or(emptyOrText, () => true);

orTupleUnion();
orTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
orTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
orTupleUnion('X', 1);
const orIncompatibleTuple = or((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
orIncompatibleTuple({ active: true });
const orCompatibleTuple = or((value: string) => value.length, emptyOrText);

orCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
orCompatibleTuple();
const orIgnoredInput = or(
  () => true,
  (value: number) => value
);

orIgnoredInput(1);

const norTupleUnion = nor(emptyOrText, () => true);

norTupleUnion();
norTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
norTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
norTupleUnion('X', 1);
const norIncompatibleTuple = nor((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
norIncompatibleTuple({ active: true });
const norCompatibleTuple = nor((value: string) => value.length, emptyOrText);

norCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
norCompatibleTuple();
const norIgnoredInput = nor(
  () => true,
  (value: number) => value
);

norIgnoredInput(1);

const xorTupleUnion = xor(emptyOrText, () => true);

xorTupleUnion();
xorTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
xorTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
xorTupleUnion('X', 1);
const xorIncompatibleTuple = xor((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
xorIncompatibleTuple({ active: true });
const xorCompatibleTuple = xor((value: string) => value.length, emptyOrText);

xorCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
xorCompatibleTuple();
const xorIgnoredInput = xor(
  () => true,
  (value: number) => value
);

xorIgnoredInput(1);

const andAsyncTupleUnion = andAsync(emptyOrText, () => true);

andAsyncTupleUnion();
andAsyncTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
andAsyncTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
andAsyncTupleUnion('X', 1);
const andAsyncIncompatibleTuple = andAsync((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
andAsyncIncompatibleTuple({ active: true });
const andAsyncCompatibleTuple = andAsync((value: string) => value.length, emptyOrText);

andAsyncCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
andAsyncCompatibleTuple();
const andAsyncIgnoredInput = andAsync(
  () => true,
  (value: number) => value
);

andAsyncIgnoredInput(1);

const orAsyncTupleUnion = orAsync(emptyOrText, () => true);

orAsyncTupleUnion();
orAsyncTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
orAsyncTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
orAsyncTupleUnion('X', 1);
const orAsyncIncompatibleTuple = orAsync((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
orAsyncIncompatibleTuple({ active: true });
const orAsyncCompatibleTuple = orAsync((value: string) => value.length, emptyOrText);

orAsyncCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
orAsyncCompatibleTuple();
const orAsyncIgnoredInput = orAsync(
  () => true,
  (value: number) => value
);

orAsyncIgnoredInput(1);

const norAsyncTupleUnion = norAsync(emptyOrText, () => true);

norAsyncTupleUnion();
norAsyncTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
norAsyncTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
norAsyncTupleUnion('X', 1);
const norAsyncIncompatibleTuple = norAsync((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
norAsyncIncompatibleTuple({ active: true });
const norAsyncCompatibleTuple = norAsync((value: string) => value.length, emptyOrText);

norAsyncCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
norAsyncCompatibleTuple();
const norAsyncIgnoredInput = norAsync(
  () => true,
  (value: number) => value
);

norAsyncIgnoredInput(1);

const xorAsyncTupleUnion = xorAsync(emptyOrText, () => true);

xorAsyncTupleUnion();
xorAsyncTupleUnion('X');
// @ts-expect-error explicit undefined is not an empty call
xorAsyncTupleUnion(undefined);
// @ts-expect-error the tuple union keeps its complete argument list
xorAsyncTupleUnion('X', 1);
const xorAsyncIncompatibleTuple = xorAsync((value: { active: boolean }) => value.active, emptyOrText);

// @ts-expect-error an object does not satisfy the possibly executed text callback
xorAsyncIncompatibleTuple({ active: true });
const xorAsyncCompatibleTuple = xorAsync((value: string) => value.length, emptyOrText);

xorAsyncCompatibleTuple('X');
// @ts-expect-error the ordinary callback still requires a string
xorAsyncCompatibleTuple();
const xorAsyncIgnoredInput = xorAsync(
  () => true,
  (value: number) => value
);

xorAsyncIgnoredInput(1);

const andContextualReceiver = and(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

andContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
andContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
andContextualReceiver.call({}, 1);

const orContextualReceiver = or(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

orContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
orContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
orContextualReceiver.call({}, 1);

const norContextualReceiver = nor(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

norContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
norContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
norContextualReceiver.call({}, 1);

const xorContextualReceiver = xor(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

xorContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
xorContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
xorContextualReceiver.call({}, 1);

const andAsyncContextualReceiver = andAsync(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

andAsyncContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
andAsyncContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
andAsyncContextualReceiver.call({}, 1);

const orAsyncContextualReceiver = orAsync(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

orAsyncContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
orAsyncContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
orAsyncContextualReceiver.call({}, 1);

const norAsyncContextualReceiver = norAsync(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

norAsyncContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
norAsyncContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
norAsyncContextualReceiver.call({}, 1);

const xorAsyncContextualReceiver = xorAsync(
  function (this: { minimum: number }, value: number) {
    return value > this.minimum;
  },
  (value) => value > 0
);

xorAsyncContextualReceiver.call({ minimum: 0 }, 1);
// @ts-expect-error a contextually inferred callback cannot erase a required receiver
xorAsyncContextualReceiver(1);
// @ts-expect-error all declared receiver fields remain required
xorAsyncContextualReceiver.call({}, 1);

and(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
and(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

or(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
or(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

nor(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
nor(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

xor(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
xor(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

andAsync(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
andAsync(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

orAsync(
  null,
  (value: string) => value.length,
  (value) => {
    // @ts-expect-error contextual inference survives a leading nullish callback
    return value.doesNotExist();
  }
);
orAsync(
  (value) => {
    // @ts-expect-error a later annotated callback supplies the contextual input type
    return value.doesNotExist();
  },
  (value: string) => value.length
);

const andContextualArity = and(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

andContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
andContextualArity('X');

const orContextualArity = or(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

orContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
orContextualArity('X');

const norContextualArity = nor(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

norContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
norContextualArity('X');

const xorContextualArity = xor(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

xorContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
xorContextualArity('X');

const andAsyncContextualArity = andAsync(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

andAsyncContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
andAsyncContextualArity('X');

const orAsyncContextualArity = orAsync(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

orAsyncContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
orAsyncContextualArity('X');

const norAsyncContextualArity = norAsync(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

norAsyncContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
norAsyncContextualArity('X');

const xorAsyncContextualArity = xorAsync(
  (value: string) => value.length,
  (value, index: number) => {
    const text: string = value;

    // @ts-expect-error a shorter callback still supplies the first argument's contextual type
    value.doesNotExist();

    return text.length + index;
  }
);

xorAsyncContextualArity('X', 1);
// @ts-expect-error contextual typing cannot erase the second callback's required argument
xorAsyncContextualArity('X');

const andExplicitContext = and<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

andExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
andExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
andExplicitContext.call({ prefix: '>' }, 1);

const orExplicitContext = or<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

orExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
orExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
orExplicitContext.call({ prefix: '>' }, 1);

const norExplicitContext = nor<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

norExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
norExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
norExplicitContext.call({ prefix: '>' }, 1);

const xorExplicitContext = xor<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

xorExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
xorExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
xorExplicitContext.call({ prefix: '>' }, 1);

const andAsyncExplicitContext = andAsync<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

andAsyncExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
andAsyncExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
andAsyncExplicitContext.call({ prefix: '>' }, 1);

const orAsyncExplicitContext = orAsync<{ prefix: string }, [value: string]>(function (value) {
  return this.prefix + value;
});

orAsyncExplicitContext.call({ prefix: '>' }, 'X');
// @ts-expect-error explicit type arguments retain the required receiver
orAsyncExplicitContext('X');
// @ts-expect-error explicit type arguments retain the input type
orAsyncExplicitContext.call({ prefix: '>' }, 1);
