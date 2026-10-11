import { REGIMES, TICKS_PER_DAY, toCandles, type Regime, type SimulationResult } from '@gaemigul/queen';

const TICKS_PER_HOUR = TICKS_PER_DAY / 24;

export interface SimulationStats {
    totalReturn: number;
    /** 일간 로그 수익률의 표준편차. 이틀 이상이어야 계산된다 */
    dailyVol: number | null;
    /** 하루 (고가 - 저가) / 시가 의 평균 */
    avgDailyRange: number;
    maxDrawdown: number;
    regimeShare: Record<Regime, number>;
    /** 국면이 한 번 시작되면 이어지는 평균 시간 */
    regimeMeanHours: Record<Regime, number | null>;
}

export function computeStats({ prices, regimes }: SimulationResult): SimulationStats {
    const days = toCandles(prices, TICKS_PER_DAY, 0);
    const dailyReturns = days.map((d) => Math.log(d.close / d.open));
    const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const dailyVol =
        dailyReturns.length < 2
            ? null
            : Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1));
    const avgDailyRange = days.reduce((sum, d) => sum + (d.high - d.low) / d.open, 0) / days.length;

    let peak = prices[0]!;
    let maxDrawdown = 0;
    for (const p of prices) {
        if (p > peak) peak = p;
        maxDrawdown = Math.max(maxDrawdown, 1 - p / peak);
    }

    const tickCounts = REGIMES.map(() => 0);
    const runCounts = REGIMES.map(() => 0);
    for (let i = 0; i < regimes.length; i++) {
        const r = regimes[i]!;
        tickCounts[r]!++;
        if (i === 0 || regimes[i - 1] !== r) runCounts[r]!++;
    }

    const regimeShare = {} as Record<Regime, number>;
    const regimeMeanHours = {} as Record<Regime, number | null>;
    REGIMES.forEach((regime, i) => {
        regimeShare[regime] = tickCounts[i]! / regimes.length;
        regimeMeanHours[regime] = runCounts[i] ? tickCounts[i]! / runCounts[i]! / TICKS_PER_HOUR : null;
    });

    return {
        totalReturn: prices[prices.length - 1]! / prices[0]! - 1,
        dailyVol,
        avgDailyRange,
        maxDrawdown,
        regimeShare,
        regimeMeanHours,
    };
}
