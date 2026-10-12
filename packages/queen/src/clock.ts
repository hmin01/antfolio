/** 한 틱 길이(ms) */
export const TICK_MS = 10_000;

/** epoch부터 `time`까지 지난 틱 번호 */
export function tickIndexAt(time: number, epoch: number): number {
    return Math.floor((time - epoch) / TICK_MS);
}

/** `tick`번째 틱의 시작 시각 */
export function tickStartTime(tick: number, epoch: number): number {
    return epoch + tick * TICK_MS;
}
