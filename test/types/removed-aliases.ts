import { and, attempt, attemptResult, ifElse, nor, not, or, partial, pipe, repeat, tap, when, xor } from '../..';

// Standalone functions are the supported API; removed attached aliases must stay unavailable.
// @ts-expect-error use pipeAsync
void pipe.async;
// @ts-expect-error use attemptResult
void attempt.result;
// @ts-expect-error use attemptResultAsync
void attempt.resultAsync;
// @ts-expect-error use attemptResultAsync
void attemptResult.async;
// @ts-expect-error use tapAsync
void tap.async;
// @ts-expect-error use notAsync
void not.async;
// @ts-expect-error use andAsync
void and.async;
// @ts-expect-error use orAsync
void or.async;
// @ts-expect-error use partialRight
void partial.right;
// @ts-expect-error use repeatAsync
void repeat.async;
// @ts-expect-error use norAsync
void nor.async;
// @ts-expect-error use xorAsync
void xor.async;
// @ts-expect-error use whenAsync
void when.async;
// @ts-expect-error use ifElseAsync
void ifElse.async;
