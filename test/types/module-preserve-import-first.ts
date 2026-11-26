import pipeDefault, { pipe as pipeNamed } from 'go-fns/pipe';
import pipeRequired = require('go-fns/pipe');

const fromDefault: number = pipeDefault((value: string) => value.length)('value');
const fromNamed: number = pipeNamed((value: string) => value.length)('value');
const fromRequired: number = pipeRequired((value: string) => value.length)('value');

// @ts-expect-error the CommonJS callable still requires a string input
pipeRequired((value: string) => value.length)(123);
// @ts-expect-error the named ES module callable still returns a number
const wrongResult: string = pipeNamed((value: string) => value.length)('value');
