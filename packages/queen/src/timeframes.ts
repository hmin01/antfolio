import { TICK_MS } from './clock.ts';

const ticksIn = (ms: number) => ms / TICK_MS;

/** 차트 캔들 단위. 최소 단위는 한 틱 */
export const TIMEFRAMES = [
    { id: 'tick', label: `${TICK_MS / 1000}초`, ticks: 1 },
    { id: '1m', label: '1분', ticks: ticksIn(60_000) },
    { id: '5m', label: '5분', ticks: ticksIn(300_000) },
    { id: '1h', label: '1시간', ticks: ticksIn(3_600_000) },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]['id'];
