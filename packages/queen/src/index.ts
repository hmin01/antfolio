// 여왕개미: Antfolio의 가격 엔진. UI 의존성 없는 순수 TypeScript
export { TICK_MS, tickIndexAt, tickStartTime } from './clock.ts';
export { createRng, rngForTick, type Rng } from './rng.ts';
export {
    DEFAULT_PARAMS,
    LATEST_VERSION,
    PARAM_VERSIONS,
    REGIMES,
    type EngineParams,
    type ParamVersion,
    type Regime,
    type RegimeParams,
} from './params.ts';
export {
    TICKS_PER_DAY,
    baseTickVariance,
    initialState,
    simulate,
    step,
    type EngineState,
    type SimulationInput,
    type SimulationResult,
} from './engine.ts';
export { toCandles, type Candle } from './candles.ts';
export { TIMEFRAMES, type TimeframeId } from './timeframes.ts';
