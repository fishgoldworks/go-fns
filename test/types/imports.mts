import api, { pipeAsync, once } from '../../index.js';
const identity: typeof pipeAsync = api.pipe.async;
const number: Promise<number> = pipeAsync(async (s: string) => s.length)('hi');
const cached: number = once(() => 3)();

import { notAsync, andAsync, orAsync } from '../../index.js';
import deepNotAsync from '../../src/logic/notAsync.js';
import deepAndAsync from '../../src/logic/andAsync.js';
import deepOrAsync from '../../src/logic/orAsync.js';
const notAlias: typeof notAsync = api.not.async;
const andAlias: typeof andAsync = api.and.async;
const orAlias: typeof orAsync = api.or.async;
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
const whenAlias: typeof whenAsync = api.when.async;
const ifElseAlias: typeof ifElseAsync = api.ifElse.async;
const norAlias: typeof norAsync = api.nor.async;
const xorAlias: typeof xorAsync = api.xor.async;
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
