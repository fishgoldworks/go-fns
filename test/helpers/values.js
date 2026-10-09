'use strict';
const hostile = {
  [Symbol.toPrimitive]() {
    throw new Error('Validation must not coerce values');
  }
};
const hostileProxy = new Proxy(
  {},
  {
    get() {
      throw new Error('Validation must not read object properties');
    }
  }
);
exports.invalidFunctions = [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['true', true],
  ['zero', 0],
  ['number', 7],
  ['NaN', NaN],
  ['infinity', Infinity],
  ['empty string', ''],
  ['string', 'fn'],
  ['array', []],
  ['object', {}],
  ['boxed number', new Number(2)],
  ['null-prototype object', Object.create(null)],
  ['symbol', Symbol('invalid')],
  ['bigint', 1n],
  ['set', new Set()],
  ['map', new Map()],
  ['date', new Date(0)],
  ['regexp', /x/],
  ['hostile coercion', hostile],
  ['hostile proxy', hostileProxy]
];
exports.values = [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['zero', 0],
  ['negative zero', -0],
  ['zero bigint', 0n],
  ['NaN', NaN],
  ['empty string', ''],
  ['true', true],
  ['number', 2],
  ['negative number', -2],
  ['bigint', 2n],
  ['infinity', Infinity],
  ['string', 'ok'],
  ['array', []],
  ['object', {}],
  ['symbol', Symbol('value')],
  ['boxed false', new Boolean(false)],
  ['function', function () {}]
];
