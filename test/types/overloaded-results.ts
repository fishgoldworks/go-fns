import { pipe, pipeAsync, partialRight, partial } from '../../index';

declare function convert(value: string): number;
declare function convert(value: number): string;

// The captured return type comes from the final overload. Checking another overload's
// inputs would claim string for the actual numeric result of convert('text').
// @ts-expect-error an earlier overload cannot justify the captured return type
pipe(() => 'text', convert);
// @ts-expect-error nullish gaps must obey the same captured signature
pipe(() => 'text', null, convert);
// @ts-expect-error the async result would also be typed incorrectly
pipeAsync(() => 'text', convert);
// @ts-expect-error sparse async pipelines must obey the same captured signature
pipe.async(() => 'text', undefined, convert);
// @ts-expect-error binding a string selects an overload with a different result
partialRight(convert, 'text');
// @ts-expect-error alias must preserve the same captured signature
partial.right(convert, 'text');
declare const tail: (typeof convert)[];
// @ts-expect-error every dynamic stage iteration must use its captured input/output pair
pipe(() => 'text', ...tail);
// @ts-expect-error awaiting stages does not reconcile different overload results
pipeAsync(() => 'text', ...tail);

const finalSignature: string = pipe(() => 123, convert)();
const sparseFinal: string = pipe(() => 123, null, convert)();
const asyncFinal: Promise<string> = pipeAsync(() => 123, convert)();
const rightFinal: string = partialRight(convert, 123)();
const earlierAdapter: number = pipe(
  () => 'text',
  (value: string) => convert(value)
)();
const rightAdapter: number = partialRight((value: string) => convert(value), 'text')();
const ignoresInput: number = pipe(
  () => 'text',
  null,
  () => 1
)();
const optional: number = pipe(
  () => undefined,
  null,
  (value: string = 'x') => value.length
)();
const rest: string = pipe(
  () => 123,
  null,
  (...values: number[]) => values.join(',')
)();
