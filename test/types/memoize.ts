import { memoize } from '../..';

const read = memoize(
  function (this: { prefix: string }, name: string, suffix?: string) {
    return Promise.resolve(this.prefix + name + (suffix ?? ''));
  },
  { maxSize: 4 }
);

const value: Promise<string> = read.call({ prefix: 'Hi ' }, 'Ada');
const cleared: undefined = read.clear();

// @ts-expect-error Receivers are part of the callback's signature.
read('Ada');
// @ts-expect-error Parameter types are preserved.
read.call({ prefix: 'Hi ' }, 5);
// @ts-expect-error Cache size is numeric.
memoize(() => 1, { maxSize: '2' });

void [value, cleared];
