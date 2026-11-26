import pipeRequired = require('go-fns/pipe');
import pipeDefault, { pipe as pipeNamed } from 'go-fns/pipe';

const fromRequired: number = pipeRequired((value: string) => value.length)('value');
const fromDefault: number = pipeDefault((value: string) => value.length)('value');
const fromNamed: number = pipeNamed((value: string) => value.length)('value');

// @ts-expect-error the named ES module callable still requires a string input
pipeNamed((value: string) => value.length)(123);
// @ts-expect-error the CommonJS callable still returns a number
const wrongResult: string = pipeRequired((value: string) => value.length)('value');
