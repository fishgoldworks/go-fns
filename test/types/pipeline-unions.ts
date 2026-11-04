import { pipe, pipeAsync } from '../../index';
import pipeAsyncDeep = require('../../src/pipeAsync');

const incompatible = Math.random() > 0.5 ? (n: number) => n.toFixed() : (s: string) => s.toUpperCase();
{
  const single = pipe(incompatible);
  // @ts-expect-error the string alternative cannot receive a number
  single(1);
  // @ts-expect-error the numeric alternative cannot receive a string
  single('x');
  const leading = pipe(null, undefined, incompatible);
  // @ts-expect-error leading gaps cannot erase an input alternative
  leading(1);
  const trailing = pipe(incompatible, null, undefined);
  // @ts-expect-error trailing gaps cannot erase an input alternative
  trailing(1);
  const surrounded = pipe(null, incompatible, undefined);
  // @ts-expect-error gaps on both sides cannot erase an input alternative
  surrounded(1);
}
{
  const single = pipeAsync(incompatible);
  // @ts-expect-error the string alternative cannot receive a number
  single(1);
  // @ts-expect-error the numeric alternative cannot receive a string
  single('x');
  const leading = pipeAsync(null, undefined, incompatible);
  // @ts-expect-error leading gaps cannot erase an input alternative
  leading(1);
  const trailing = pipeAsync(incompatible, null, undefined);
  // @ts-expect-error trailing gaps cannot erase an input alternative
  trailing(1);
  const surrounded = pipeAsync(null, incompatible, undefined);
  // @ts-expect-error gaps on both sides cannot erase an input alternative
  surrounded(1);
}
{
  const single = pipeAsyncDeep(incompatible);
  // @ts-expect-error the string alternative cannot receive a number
  single(1);
  // @ts-expect-error the numeric alternative cannot receive a string
  single('x');
  const leading = pipeAsyncDeep(null, undefined, incompatible);
  // @ts-expect-error leading gaps cannot erase an input alternative
  leading(1);
  const trailing = pipeAsyncDeep(incompatible, null, undefined);
  // @ts-expect-error trailing gaps cannot erase an input alternative
  trailing(1);
  const surrounded = pipeAsyncDeep(null, incompatible, undefined);
  // @ts-expect-error gaps on both sides cannot erase an input alternative
  surrounded(1);
}
const structural = Math.random() > 0.5 ? (v: { a: number }) => v.a : (v: { b: number }) => v.b;
const shared = { a: 1, b: 2 };
const numberResult: number = pipe(structural)(shared);
const promised: Promise<number> = pipeAsync(structural)(shared);
const inline: number = pipe(structural)({ a: 1, b: 2 });
// @ts-expect-error the possible b callback needs b
pipe(structural)({ a: 1 });

const receivers =
  Math.random() > 0.5
    ? function (this: { a: string }, n: number) {
        return this.a + n;
      }
    : function (this: { b: string }, n: number) {
        return this.b + n;
      };
const receiver = pipe(receivers);
const receiverResult: string = receiver.call({ a: 'a', b: 'b' }, 1);
// @ts-expect-error every callback receiver alternative must be satisfied
receiver.call({ a: 'a' }, 1);
declare const mixedReceiver: ((n: number) => string) | ((this: { b: string }, n: number) => string);
const needsReceiver = pipe(mixedReceiver);
// @ts-expect-error a callback with no receiver must not erase the other requirement
needsReceiver(1);
const mixedResult: string = needsReceiver.call({ b: 'b' }, 1);

const defaults: number = pipe((n = 1) => n)();
const variadic: number = pipe((...ns: number[]) => ns.length)(1, 2);
const correlated = pipe((...args: ['string', string] | ['number', number]) => args[1]);
const either: string | number = correlated('number', 1);
// @ts-expect-error argument alternatives remain correlated
correlated('number', 'x');
