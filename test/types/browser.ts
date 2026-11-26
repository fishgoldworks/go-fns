import { sleep, delay, type TimerHandle, type AbortSignalLike } from '../..';
const controller = new AbortController();
const signal: AbortSignalLike = controller.signal;
const pending: Promise<void> = sleep(1, { signal });
const handle: number = delay((value: string) => console.log(value), 0, 'hello');
const typed: TimerHandle = handle;

clearTimeout(typed);
// @ts-expect-error missing required callback parameter
delay((value: string) => console.log(value), 0);
