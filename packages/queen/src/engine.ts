import { TICK_MS } from './clock.ts';
import { REGIMES, type EngineParams, type Regime } from './params.ts';
import { rngForTick, type Rng } from './rng.ts';

export const TICKS_PER_DAY = 86_400_000 / TICK_MS;
const TICKS_PER_HOUR = TICKS_PER_DAY / 24;

/** 변동성 뭉침 폭주 방지용 상한(기본 분산 대비 배수) */
const MAX_VARIANCE_MULTIPLE = 50;
const MAX_PERSISTENCE = 0.999;

export interface EngineState {
    tick: number;
    logPrice: number;
    /** 장기적으로 가격이 되돌아가는 기준점 */
    logFairValue: number;
    /** 다음 틱의 틱당 분산 */
    variance: number;
    regime: Regime;
    /** 현재 국면의 추세 세기. 국면마다 새로 추첨(`trendSpread` 없으면 1) */
    trendStrength: number;
}

export function baseTickVariance(params: EngineParams): number {
    return params.dailyVol ** 2 / TICKS_PER_DAY;
}

export function initialState(price: number, params: EngineParams, regime: Regime = 'sideways'): EngineState {
    return {
        tick: 0,
        logPrice: Math.log(price),
        logFairValue: Math.log(price),
        variance: baseTickVariance(params),
        regime,
        trendStrength: 1,
    };
}

/** 분산 1로 맞춘 Student-t 난수 */
function studentT(rng: Rng, df: number): number {
    let chiSquare = 0;
    for (let i = 0; i < df; i++) chiSquare += rng.normal() ** 2;
    return (rng.normal() / Math.sqrt(chiSquare / df)) * Math.sqrt((df - 2) / df);
}

function nextRegime(rng: Rng, current: Regime, params: EngineParams): Regime {
    const leaveChance = 1 / (params.regimes[current].meanHours * TICKS_PER_HOUR);
    if (rng.next() >= leaveChance) return current;
    const others = REGIMES.filter((r) => r !== current);
    return others[Math.floor(rng.next() * others.length)]!;
}

/** 한 틱 진행 후 상태. 같은 시드·상태면 항상 같은 결과 */
export function step(state: EngineState, params: EngineParams, seed: number): EngineState {
    const tick = state.tick + 1;
    const rng = rngForTick(seed, tick);

    const regime = nextRegime(rng, state.regime, params);
    const { driftPerDay, volScale } = params.regimes[regime];

    // 평균 1인 로그정규 분포. 설정이 없으면 난수를 뽑지 않아 예전 버전 결과 유지
    const spread = params.trendSpread;
    const trendStrength =
        spread !== undefined && regime !== state.regime
            ? Math.exp(spread * rng.normal() - spread ** 2 / 2)
            : state.trendStrength;

    const drift = (driftPerDay * trendStrength) / TICKS_PER_DAY;
    const reversionRate = Math.LN2 / (params.reversionHalfLifeDays * TICKS_PER_DAY);
    const reversion = -reversionRate * (state.logPrice - state.logFairValue);

    const diffusion = Math.sqrt(state.variance) * studentT(rng, params.tailDf);
    const jumpChance = params.jumps.perDay / TICKS_PER_DAY;
    const jump = rng.next() < jumpChance ? rng.normal() * params.jumps.size : 0;
    const shock = diffusion + jump;
    const clusterShock = diffusion + jump * (params.jumps.volKick ?? 1);

    const { alpha } = params.clustering;
    const beta = Math.min(params.clustering.beta, MAX_PERSISTENCE - alpha);
    const base = baseTickVariance(params);
    const variance = Math.min(
        base * (1 - alpha - beta) + alpha * clusterShock ** 2 + beta * state.variance,
        base * MAX_VARIANCE_MULTIPLE,
    );

    return {
        tick,
        logPrice: state.logPrice + drift + reversion + shock * volScale,
        logFairValue: state.logFairValue,
        variance,
        regime,
        trendStrength,
    };
}

export interface SimulationInput {
    seed: number;
    params: EngineParams;
    initialPrice: number;
    ticks: number;
}

export interface SimulationResult {
    /** prices[i]: i번째 틱 종료 후 가격, prices[0]: 시작 가격 */
    prices: Float64Array;
    /** regimes[i]: i번째 틱의 국면(REGIMES 인덱스) */
    regimes: Uint8Array;
}

export function simulate({ seed, params, initialPrice, ticks }: SimulationInput): SimulationResult {
    const prices = new Float64Array(ticks + 1);
    const regimes = new Uint8Array(ticks + 1);

    let state = initialState(initialPrice, params);
    prices[0] = initialPrice;
    regimes[0] = REGIMES.indexOf(state.regime);

    for (let i = 1; i <= ticks; i++) {
        state = step(state, params, seed);
        prices[i] = Math.exp(state.logPrice);
        regimes[i] = REGIMES.indexOf(state.regime);
    }

    return { prices, regimes };
}
