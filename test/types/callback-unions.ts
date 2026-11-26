import {
  once,
  pipe,
  pipeAsync,
  partialRight,
  repeat,
  repeatAsync,
  attempt,
  attemptResult,
  attemptResultAsync,
  delay
} from '../../index';

// Requirements must cover every callback that could be selected at runtime.
const differentInputs = Math.random() > 0.5 ? (n: number) => n.toFixed() : (s: string) => s.toUpperCase();

// @ts-expect-error the saved string is invalid for the numeric alternative
partialRight(differentInputs, 'x');
const unchanged = partialRight(differentInputs);

// @ts-expect-error no suffix does not erase the string alternative
unchanged(1);
// @ts-expect-error no suffix does not erase the numeric alternative
unchanged('x');
const differingPrefix =
  Math.random() > 0.5
    ? (n: number, suffix: string) => n.toFixed() + suffix
    : (s: string, suffix: string) => s.toUpperCase() + suffix;
const right = partialRight(differingPrefix, 'x');

// @ts-expect-error the selected callback might need a string prefix
right(1);
// @ts-expect-error the selected callback might need a numeric prefix
right('x');
const structural =
  Math.random() > 0.5
    ? (v: { a: number }, suffix: string) => v.a.toFixed() + suffix
    : (v: { b: string }, suffix: string) => v.b.toUpperCase() + suffix;
const both = partialRight(structural, '!');
const combined: string = both({ a: 1, b: 'x' });

// @ts-expect-error the selected callback may require b
both({ a: 1 });

// Direct execution helpers must not accept an argument valid for just one member.
// @ts-expect-error requires every selected callback's parameter contract
repeat(differentInputs, 1, 1);
// @ts-expect-error asynchronous repetition obeys the same parameter contract
repeatAsync(differentInputs, 1, 1);
// @ts-expect-error returning a thrown value does not make invalid arguments type-safe
attempt(differentInputs, 1);
// @ts-expect-error structured results do not make invalid arguments type-safe
attemptResult(differentInputs, 1);
// @ts-expect-error async results do not make invalid arguments type-safe
attemptResultAsync(differentInputs, 1);
// @ts-expect-error delayed callback must be callable with the supplied arguments
delay(differentInputs, 0, 1);
const shared = Math.random() > 0.5 ? (v: { a: number }) => v.a : (v: { b: string }) => v.b.length;
const repeated: number[] = repeat(shared, 1, { a: 1, b: 'b' });

attempt(shared, { a: 1, b: 'b' });
attemptResult(shared, { a: 1, b: 'b' });
attemptResultAsync(shared, { a: 1, b: 'b' });
repeatAsync(shared, 1, { a: 1, b: 'b' });
delay(shared, 0, { a: 1, b: 'b' });

// A callable without a this annotation must not erase another callable's this.
const dynamicStages: (((this: { prefix: string }, s: string) => string) | ((s: string) => string))[] = [
  function (this: { prefix: string }, s: string) {
    return this.prefix.toUpperCase() + s;
  }
];
const dynamic = pipe(...dynamicStages);
const dynamicAsync = pipeAsync(...dynamicStages);

// @ts-expect-error a possible stage requires a receiver
dynamic('x');
// @ts-expect-error an async pipeline has the same receiver requirements
dynamicAsync('x');
const value: string | undefined = dynamic.call({ prefix: 'p' }, 'x');
const promised: Promise<string | undefined> = dynamicAsync.call({ prefix: 'p' }, 'x');

// @ts-expect-error incorrect receiver remains invalid
dynamic.call({}, 'x');
// @ts-expect-error incorrect receiver remains invalid for async execution
dynamicAsync.call({}, 'x');

// A safe branch must not erase another branch's incompatible callback-as-this.
const receiverUnion =
  Math.random() > 0.5
    ? function (this: { prefix: string }, n: number) {
        return this.prefix.toUpperCase() + n;
      }
    : (n: number) => n;

// @ts-expect-error one possible callback cannot use itself as its receiver
repeat(receiverUnion, 1, 1);
// @ts-expect-error async repetition has the same receiver policy
repeatAsync(receiverUnion, 1, 1);
// @ts-expect-error catching callback failures does not erase receiver requirements
attempt(receiverUnion, 1);
// @ts-expect-error unsafe callback-as-receiver union must be rejected
attemptResult(receiverUnion, 1);
// @ts-expect-error async results retain the same callback receiver requirements
attemptResultAsync(receiverUnion, 1);
const ownReceiver = Object.assign(
  function (this: { offset: number }, n: number) {
    return this.offset + n;
  },
  { offset: 2 }
);
const safeUnion = Math.random() > 0.5 ? ownReceiver : (n: number) => String(n);

repeat(safeUnion, 1, 2);
repeatAsync(safeUnion, 1, 2);
attempt(safeUnion, 2);
attemptResult(safeUnion, 2);
attemptResultAsync(safeUnion, 2);

// One unrestricted receiver must not erase another union member's requirement.
const anyReceiverUnion =
  Math.random() > 0.5
    ? function (this: { prefix: string }, n: number) {
        return this.prefix.toUpperCase() + n;
      }
    : function (this: any, n: number) {
        return n;
      };

const anyReceiverOnce = once(anyReceiverUnion);
const anyReceiverPipe = pipe(anyReceiverUnion);
const anyReceiverAsync = pipeAsync(anyReceiverUnion);
const anyReceiverRight = partialRight(anyReceiverUnion, 1);
const anyReceiverSparse = pipeAsync(null, anyReceiverUnion, undefined);

// @ts-expect-error the concrete receiver is still required
anyReceiverOnce(1);
// @ts-expect-error the concrete receiver is still required
anyReceiverPipe(1);
// @ts-expect-error the concrete receiver is still required
anyReceiverAsync(1);
// @ts-expect-error binding inputs does not bind the required receiver
anyReceiverRight();
// @ts-expect-error nullish gaps preserve receiver requirements
anyReceiverSparse(1);
// @ts-expect-error an explicit incompatible receiver is also unsafe
anyReceiverOnce.call({}, 1);
// @ts-expect-error an explicit incompatible receiver is also unsafe
anyReceiverPipe.call({}, 1);
// @ts-expect-error an explicit incompatible receiver is also unsafe
anyReceiverAsync.call({}, 1);
// @ts-expect-error an explicit incompatible receiver is also unsafe
anyReceiverRight.call({});
const safeAnyReceiverOnce: string | number = anyReceiverOnce.call({ prefix: 'x' }, 1);
const safeAnyReceiverPipe: string | number = anyReceiverPipe.call({ prefix: 'x' }, 1);
const safeAnyReceiverAsync: Promise<string | number> = anyReceiverAsync.call({ prefix: 'x' }, 1);
const safeAnyReceiverRight: string | number = anyReceiverRight.call({ prefix: 'x' });
// An independently unrestricted callback remains callable without a receiver.
const onlyAnyReceiver = function (this: any, n: number) {
  return n;
};

const onlyAnyOnce: number = once(onlyAnyReceiver)(1);
const onlyAnyPipe: number = pipe(onlyAnyReceiver)(1);
const onlyAnyAsync: Promise<number> = pipeAsync(onlyAnyReceiver)(1);
const onlyAnyRight: number = partialRight(onlyAnyReceiver, 1)();
