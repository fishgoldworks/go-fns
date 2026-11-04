import { pipe, pipeAsync, when, ifElse } from '../../index';
import pipeDeep = require('../../src/pipe');
import pipeAsyncDeep = require('../../src/pipeAsync');
import whenDeep = require('../../src/when');
import ifElseDeep = require('../../src/ifElse');

type Context = { prefix: string };
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type ReceiversMatch<S extends readonly unknown[]> = {
  [K in keyof S]: Equal<ThisParameterType<S[K]>, Context>;
}[number];
const context: Context = { prefix: 'prefix' };
function required(this: Context, value: string) {
  return this.prefix.toUpperCase() + value;
}
function unrestricted(this: any, value: string) {
  return value;
}
function condition(this: any, value: string) {
  return value.length > 0;
}
function requiredCondition(this: Context, value: string) {
  return value === this.prefix.toUpperCase();
}
function guard(this: any, value: string | number): value is string {
  return typeof value === 'string';
}
function requiredGuard(this: Context, value: string | number): value is string {
  return typeof value === 'string' && value === this.prefix.toUpperCase();
}

// Every contextual pipeline length and receiver position retains concrete requirements.
const pipelines = [
  pipe(required, unrestricted),
  pipe(unrestricted, required),
  pipe(unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipe(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required),
  pipeDeep(required, unrestricted)
] as const;
type PipelineReceivers = Assert<ReceiversMatch<typeof pipelines>>;
for (const pipeline of pipelines) {
  const result: string = pipeline.call(context, 'x');
  // @ts-expect-error an unrestricted stage cannot remove another stage's receiver
  pipeline('x');
  // @ts-expect-error all required receiver properties must be present
  pipeline.call({}, 'x');
  // @ts-expect-error the input type is preserved
  pipeline.call(context, 1);
  void result;
}
const asyncPipelines = [
  pipeAsync(required, unrestricted),
  pipeAsync(unrestricted, required),
  pipeAsync(unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required, unrestricted),
  pipeAsync(unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, unrestricted, required),
  pipeAsyncDeep(required, unrestricted)
] as const;
type AsyncPipelineReceivers = Assert<ReceiversMatch<typeof asyncPipelines>>;
for (const pipeline of asyncPipelines) {
  const result: Promise<string> = pipeline.call(context, 'x');
  // @ts-expect-error async composition retains the same receiver requirement
  pipeline('x');
  // @ts-expect-error all required receiver properties must be present
  pipeline.call({}, 'x');
  // @ts-expect-error awaiting results does not change the input type
  pipeline.call(context, 1);
  void result;
}

// Include normal, narrowed and ignored-argument branch overloads.
const conditionals = [
  when(condition, required),
  when(requiredCondition, unrestricted),
  when(guard, required),
  when(requiredGuard, unrestricted),
  whenDeep(condition, required),
  ifElse(condition, required, unrestricted),
  ifElse(condition, unrestricted, required),
  ifElse(requiredCondition, unrestricted, unrestricted),
  ifElse(guard, required, (value) => value.toFixed()),
  ifElse(requiredGuard, unrestricted, (value) => value.toFixed()),
  ifElse(guard, unrestricted, function (this: Context, value) {
    return this.prefix + value.toFixed();
  }),
  ifElse(() => true, required, unrestricted),
  ifElse(
    () => false,
    function (this: any) {
      return 'unused';
    },
    required
  ),
  ifElseDeep(condition, required, unrestricted)
] as const;
type ConditionalReceivers = Assert<ReceiversMatch<typeof conditionals>>;
for (const conditional of conditionals) {
  const result: string | number = conditional.call(context, 'x');
  // @ts-expect-error every possible callback's receiver must be satisfied
  conditional('x');
  // @ts-expect-error a selected branch or predicate may require prefix
  conditional.call({}, 'x');
  void result;
}

const combined = pipe(required, unrestricted, function (this: { suffix: string }, value) {
  return value + this.suffix;
});
const both: string = combined.call({ prefix: 'p', suffix: 's' }, 'x');
// @ts-expect-error both concrete receivers are required
combined.call(context, 'x');
const free: string = pipe(unrestricted, unrestricted)('x');
const freeAsync: Promise<string> = pipeAsync(unrestricted, unrestricted)('x');
const freeWhen: string = when(condition, unrestricted)('x');
const freeChoice: string = ifElse(condition, unrestricted, unrestricted)('x');
void [both, free, freeAsync, freeWhen, freeChoice];
