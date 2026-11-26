import { ary } from '../..';

const render = ary(function (this: { prefix: string }, name: string, upper?: boolean) {
  return this.prefix + (upper ? name.toUpperCase() : name);
}, 1);
const output: string = render.call({ prefix: 'Hi ' }, 'Ada');

// @ts-expect-error The required receiver is preserved.
render('Ada');
// @ts-expect-error The cap would discard a required argument.
ary((name: string) => name, 0);
// @ts-expect-error The cap must be explicit.
ary((...values: string[]) => values);

declare const dynamic: number;
declare const either: 1 | 2;
const values: string[] = ary((...args: string[]) => args, dynamic)('one', 'two');
const sum: number = ary((first: number, ...rest: number[]) => first + rest.length, either)(1, 2);

// @ts-expect-error An unknown cap may discard a required argument.
ary((first: number) => first, dynamic);
// @ts-expect-error Every possible cap must preserve required arguments.
ary((first: number, second: number) => first + second, either);

void [output, values, sum];
