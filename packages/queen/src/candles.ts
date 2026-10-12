import { tickStartTime } from './clock.ts';

export interface Candle {
    /** 캔들 시작 시각(ms) */
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** 틱 가격을 `ticksPerCandle`개씩 묶은 캔들 목록. 시가는 직전 캔들 종가(한 틱 캔들도 몸통 생김), 덜 찬 마지막 캔들 포함 */
export function toCandles(prices: ArrayLike<number>, ticksPerCandle: number, epoch: number): Candle[] {
    const candles: Candle[] = [];
    const lastTick = prices.length - 1;

    for (let start = 0; start < lastTick; start += ticksPerCandle) {
        const end = Math.min(start + ticksPerCandle, lastTick);
        const open = prices[start]!;
        let high = open;
        let low = open;
        for (let i = start + 1; i <= end; i++) {
            const p = prices[i]!;
            if (p > high) high = p;
            if (p < low) low = p;
        }
        candles.push({ time: tickStartTime(start, epoch), open, high, low, close: prices[end]! });
    }

    return candles;
}
