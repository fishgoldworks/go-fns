import { applyIf } from '../../index';
import focused = require('../../src/applyIf');
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
const matching: typeof applyIf = focused;
const converted = applyIf('42', true, (value) => {
  const text: string = value;
  const precise: false = false as IsAny<typeof value>;

  // @ts-expect-error Callback input is text, not any.
  value.toFixed();

  return Number(text) + Number(precise);
});

type Converted = Expect<Equal<typeof converted, number>>;
const original = { id: 1 } as const;
const skipped = focused(original, false, (value) => value.id);

type Skipped = Expect<Equal<typeof skipped, typeof original>>;
declare const enabled: boolean;
const dynamic: string | number = applyIf('42', enabled, (value) => Number(value));
const fromPredicate: string | number = applyIf(
  '42',
  (value) => value.length,
  (value) => Number(value)
);
const asyncPredicate: string | number = applyIf(
  '42',
  async (value) => value.length,
  (value) => Number(value)
);
const promise: Promise<number> = applyIf(2, true, async (value) => value + 1);
const rawThenable = {
  then() {
    return 1;
  }
};
const returned: typeof rawThenable = focused(2, true, () => rawThenable);
const absent: undefined = focused(undefined, false, () => 1);
const callbacks = { apply: applyIf, multiplier: 3 };
const contextual: number = callbacks.apply(2, true, function (value) {
  const multiplier: number = this.multiplier;

  // @ts-expect-error The contextual receiver is not any or a number.
  this.toFixed();

  return value * multiplier;
});
const condition: boolean | ((value: number) => unknown) = enabled ? true : (value) => value;
const policy: number | string = applyIf(2, condition, (value) => String(value));

// @ts-expect-error Required condition is absent.
applyIf(1);
// @ts-expect-error Required transform is absent.
focused(1, false);
// @ts-expect-error Undefined is not a supplied condition.
applyIf(1, undefined, (value) => value);
// @ts-expect-error Only booleans and predicates are valid conditions.
applyIf(1, 1, (value) => value);
// @ts-expect-error Invalid transform is rejected even for false.
applyIf(1, false, null);
// @ts-expect-error The input determines the callback parameter.
applyIf('42', true, (value: number) => value);
const numberOnlyPredicate = (value: number) => value;

// @ts-expect-error Predicate inputs must accept the supplied value.
applyIf('42', numberOnlyPredicate, (value) => value);
// @ts-expect-error A dynamic decision can preserve its string input.
const guaranteedNumber: number = applyIf('42', enabled, (value) => Number(value));
const readonly: readonly number[] = [1, 2];

applyIf(readonly, true, (value) => {
  // @ts-expect-error Readonly input stays readonly inside the callback.
  value.push(3);

  return value.length;
});
function needsReceiver(this: { multiplier: number }, value: number) {
  return this.multiplier * value;
}

// @ts-expect-error A plain call cannot supply the callback's required receiver.
applyIf(2, true, needsReceiver);

const explicitUndefined: number = applyIf(2, true, function (this: undefined, value) {
  return value + 1;
});
const undefinedPredicate: number = applyIf(
  2,
  function (this: undefined, value) {
    return value > 0;
  },
  (value) => value + 1
);
const explicitVoid: number = applyIf(2, true, function (this: void, value) {
  return value + 1;
});
