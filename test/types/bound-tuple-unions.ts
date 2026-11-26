import { partialRight } from '../../index';
import partialRightDeep = require('../../src/partialRight');

declare const suffix: [number] | [number, number];
function pair(this: { label: string }, first: number, second: number) {
  return this.label + first.toFixed() + second.toFixed();
}

const bound = partialRight(pair, ...suffix);

// @ts-expect-error the saved tuple might contain only the final argument
bound.call({ label: 'pair' });
const focused = partialRightDeep(pair, ...suffix);

// @ts-expect-error focused imports must retain every possible saved-argument count
focused.call({ label: 'pair' });

// Empty/nonempty alternatives must not erase an unbound required argument.
declare const maybeSuffix: [] | [number];
const maybeBound = partialRight((value: number) => value.toFixed(), ...maybeSuffix);

// @ts-expect-error the saved tuple might be empty
maybeBound();

// Narrowing a saved tuple before binding retains ordinary precise calls.
if (suffix.length === 1) {
  const value: string = partialRight(pair, ...suffix).call({ label: 'pair' }, 1);

  void value;
} else {
  const value: string = partialRight(pair, ...suffix).call({ label: 'pair' });

  void value;
}

// Equal-length alternatives share a valid prefix, without widening that prefix.
declare const mixedSuffix: [string] | [number];
const mixed = partialRight((head: boolean, tail: string | number) => (head ? String(tail) : ''), ...mixedSuffix);
const mixedResult: string = mixed(true);

// @ts-expect-error a saved tuple union cannot erase a required prefix
mixed();
// @ts-expect-error prefix type is independent of the saved alternatives
mixed(1);

// Rest signatures keep their fixed prefix and accept either saved tuple length.
const rest = partialRight((head: string, ...values: number[]) => head + values.length, ...suffix);
const restResult: string = rest('head', 1, 2);

// @ts-expect-error the required prefix is not supplied by numeric saved arguments
rest();
// @ts-expect-error the fixed prefix must remain a string
rest(1);
const optional = partialRight((head: string, extra?: number, ...values: number[]) => head + values.length, ...suffix);
const optionalResult: string = optional('head', undefined, 1);

// @ts-expect-error optional slots remain explicit before the saved rest arguments
optional('head');
void [mixedResult, restResult, optionalResult];
