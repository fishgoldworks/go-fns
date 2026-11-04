import api, { pipeAsync, once } from '../../index.js';
const identity: typeof pipeAsync = api.pipeAsync;
const number: Promise<number> = pipeAsync(async (s: string) => s.length)('hi');
const cached: number = once(() => 3)();

import { notAsync, andAsync, orAsync } from '../../index.js';
import deepNotAsync from '../../src/logic/notAsync.js';
import deepAndAsync from '../../src/logic/andAsync.js';
import deepOrAsync from '../../src/logic/orAsync.js';
const notNamed: typeof notAsync = api.notAsync;
const andNamed: typeof andAsync = api.andAsync;
const orNamed: typeof orAsync = api.orAsync;
const negated: Promise<boolean> = deepNotAsync(async (s: string) => s.length)('hi');
const conjunction: Promise<boolean> = deepAndAsync(
  (n: number) => n > 0,
  async (n: number) => n < 10
)(2);
const disjunction: Promise<boolean> = deepOrAsync(async (n: number) => n > 0)(2);

import { whenAsync, ifElseAsync, norAsync, xorAsync } from '../../index.js';
import deepWhenAsync from '../../src/whenAsync.js';
import deepIfElseAsync from '../../src/ifElseAsync.js';
import deepNorAsync from '../../src/logic/norAsync.js';
import deepXorAsync from '../../src/logic/xorAsync.js';
const whenNamed: typeof whenAsync = api.whenAsync;
const ifElseNamed: typeof ifElseAsync = api.ifElseAsync;
const norNamed: typeof norAsync = api.norAsync;
const xorNamed: typeof xorAsync = api.xorAsync;
const conditional: Promise<number> = deepWhenAsync(
  async (n: number) => n > 0,
  (n: number) => n * 2
)(3);
const branch: Promise<string | number> = deepIfElseAsync(
  (n: number) => n > 0,
  (n: number) => Promise.resolve(n),
  () => 'no'
)(3);
const neither: Promise<boolean> = deepNorAsync(() => false)();
const exactlyOne: Promise<boolean> = deepXorAsync(
  () => true,
  async () => false
)();

import { result } from '../../index.js';
import deepResult from '../../src/result.js';
const evaluator: typeof result = deepResult;
const evaluated: number = result((a, b) => a + b, 2, 3);

import { applyIf } from '../../index.js';
import focusedApplyIf from '../../src/applyIf.js';
const immediate: typeof applyIf = focusedApplyIf;
const immediateNumber: number = applyIf('42', true, (value) => Number(value));
const immediateInput = { id: 1 } as const;
const immediateSame: typeof immediateInput = focusedApplyIf(immediateInput, false, (value) => value.id);
