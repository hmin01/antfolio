/** 한 틱의 길이(ms). 시장은 10초마다 한 번 움직인다. */
export const TICK_MS = 10_000;

/** 시장이 열린 시각(epoch)부터 `time`까지 지난 틱 번호. */
export function tickIndexAt(time: number, epoch: number): number {
    return Math.floor((time - epoch) / TICK_MS);
}

/** `tick`번째 틱이 시작되는 시각. */
export function tickStartTime(tick: number, epoch: number): number {
    return epoch + tick * TICK_MS;
}
