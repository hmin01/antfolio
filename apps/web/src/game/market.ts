import {
    initialState,
    LATEST_VERSION,
    PARAM_VERSIONS,
    step,
    TICKS_PER_DAY,
    type EngineParams,
    type EngineState,
} from '@gaemigul/queen';

import { stockParams, STOCKS, type StockDef } from './stocks.ts';

/** 어떤 틱부터 어떤 엔진 설정 버전을 쓰는지. fromTick 오름차순 */
export type ParamSchedule = { versionId: string; fromTick: number }[];

/** 가격 기록을 들고 있는 최대 기간. 그보다 오래된 틱은 버린다 */
export const HISTORY_DAYS = 14;

/** 종목별로 저장해 두는 하루 경계 틱의 엔진 상태(틱 오름차순). 다음에 열 때 여기서부터 이어서 계산한다 */
export type EngineDays = Record<string, EngineState[]>;

export interface StockSeries {
    def: StockDef;
    seed: number;
    /** market.tick 시점의 엔진 상태 */
    state: EngineState;
    /** prices[0]에 해당하는 틱. 필요해지면 windowStart까지 앞쪽을 채운다 */
    startTick: number;
    /** prices[i]는 (startTick + i)번째 틱의 엔진 가격(반올림 전) */
    prices: number[];
    /** 기록 기간 안의 하루 경계 틱 엔진 상태 */
    dayStates: Map<number, EngineState>;
    /** 설정 버전별로 종목 성격을 입힌 파라미터 */
    paramsByVersion: Map<string, EngineParams>;
}

/** 화면과 체결에 쓰는 원 단위 가격 */
export const roundPrice = (price: number) => Math.max(1, Math.round(price));

function stockSeed(worldSeed: number, index: number): number {
    return (worldSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/** `tick`에서 기록을 남겨 두는 첫 틱. 하루 경계라 캔들 묶음이 어긋나지 않는다 */
const windowStartFor = (tick: number) =>
    Math.max(0, Math.ceil((tick - HISTORY_DAYS * TICKS_PER_DAY) / TICKS_PER_DAY) * TICKS_PER_DAY);

/** 정렬된 상태 목록에서 `tick` 이하인 가장 늦은 상태 */
function latestAtOrBefore(states: EngineState[], tick: number): EngineState | undefined {
    for (let i = states.length - 1; i >= 0; i--) if (states[i]!.tick <= tick) return states[i];
    return undefined;
}

/**
 * 모든 종목의 최근 가격을 들고 있는다. 같은 worldSeed와 설정 일정이면 언제 계산해도 같은 가격이 나온다.
 *
 * 종목마다 하루 경계의 엔진 상태를 저장해 두고, 열 때는 `needFrom` 직전의 하루 경계부터만 계산한다.
 * 그보다 오래된 가격(최대 HISTORY_DAYS일)은 차트처럼 실제로 필요할 때 그 종목만 이어서 계산한다.
 */
export class Market {
    readonly series: StockSeries[];
    readonly byId: Map<string, StockSeries>;
    tick: number;
    /** 기록을 남겨 두는 첫 틱 */
    windowStart: number;
    /** 앞으로 진행할 틱에만 영향을 주도록, 일정은 현재 틱 이후에만 추가한다 */
    schedule: ParamSchedule;

    /**
     * @param saved 저장해 둔 하루 경계 상태. 없으면 시장 시작 틱부터 계산한다
     * @param needFrom 종목마다 가격이 꼭 있어야 하는 첫 틱. 이보다 앞은 필요할 때 계산한다
     */
    constructor(
        worldSeed: number,
        schedule: ParamSchedule,
        tick: number,
        saved: EngineDays | null,
        needFrom: (stockId: string) => number,
    ) {
        this.schedule = schedule;
        this.tick = tick;
        this.windowStart = windowStartFor(tick);
        this.series = STOCKS.map((def, i) => {
            const paramsByVersion = new Map(PARAM_VERSIONS.map((v) => [v.id, stockParams(v.params, def.personality)]));
            const days = saved?.[def.id] ?? [];
            // 저장이 아예 없으면 시장 시작부터, 저장 뒤에 새로 생긴 종목이면 기록의 첫 틱에서 처음 가격으로 시작한다.
            const start = latestAtOrBefore(days, needFrom(def.id)) ??
                days[0] ?? {
                    ...initialState(def.initialPrice, this.paramsAt(paramsByVersion, 0)),
                    tick: saved ? this.windowStart : 0,
                };
            return {
                def,
                seed: stockSeed(worldSeed, i),
                state: start,
                startTick: start.tick,
                prices: [Math.exp(start.logPrice)],
                dayStates: new Map([...days, start].map((s) => [s.tick, s])),
                paramsByVersion,
            };
        });
        this.byId = new Map(this.series.map((s) => [s.def.id, s]));
        for (const s of this.series) this.run(s, tick);
    }

    private paramsAt(paramsByVersion: Map<string, EngineParams>, tick: number): EngineParams {
        return paramsByVersion.get(this.versionAt(tick)) ?? paramsByVersion.get(LATEST_VERSION.id)!;
    }

    /** `tick`에 적용되는 설정 버전. 코드에서 사라진 버전이면 최신 버전으로 대신한다. */
    versionAt(tick: number): string {
        for (let i = this.schedule.length - 1; i >= 0; i--) {
            if (this.schedule[i]!.fromTick <= tick) return this.schedule[i]!.versionId;
        }
        return this.schedule[0]?.versionId ?? LATEST_VERSION.id;
    }

    /** `from` 다음 틱부터 `target` 틱까지의 가격을 계산한다. 지나는 하루 경계 상태는 기록해 둔다 */
    private compute(s: StockSeries, from: EngineState, target: number): { prices: number[]; state: EngineState } {
        const prices: number[] = [];
        let state = from;
        while (state.tick < target) {
            state = step(state, this.paramsAt(s.paramsByVersion, state.tick + 1), s.seed);
            prices.push(Math.exp(state.logPrice));
            if (state.tick % TICKS_PER_DAY === 0) s.dayStates.set(state.tick, state);
        }
        return { prices, state };
    }

    private run(s: StockSeries, target: number) {
        const { prices, state } = this.compute(s, s.state, target);
        for (const p of prices) s.prices.push(p);
        s.state = state;
    }

    advanceTo(target: number): void {
        if (target <= this.tick) return;
        for (const s of this.series) this.run(s, target);
        this.tick = target;
    }

    /** 이 종목의 가격을 기록 기간 처음(windowStart)부터 채운다. 차트를 그리기 전에 부른다 */
    ensureHistory(stockId: string): void {
        const s = this.byId.get(stockId)!;
        if (s.startTick <= this.windowStart) return;
        const sorted = [...s.dayStates.values()].toSorted((a, b) => a.tick - b.tick);
        const from = latestAtOrBefore(sorted, this.windowStart) ?? sorted[0]!;
        if (from.tick >= s.startTick) return;
        // compute는 from 다음 틱부터 startTick까지 돌려주므로, 앞에 from을 붙이고 이미 있는 startTick 하나를 뺀다.
        const { prices } = this.compute(s, from, s.startTick);
        s.prices = [Math.exp(from.logPrice), ...prices.slice(0, -1), ...s.prices];
        s.startTick = from.tick;
    }

    /**
     * 기록이 HISTORY_DAYS보다 길면 오래된 하루치를 버린다.
     * 지난 틱의 가격으로 지정가 주문을 처리한 뒤에 부른다. 버린 틱의 가격은 다시 볼 수 없다.
     */
    trimHistory(): void {
        this.windowStart = windowStartFor(this.tick);
        for (const s of this.series) {
            if (s.startTick < this.windowStart) {
                s.prices = s.prices.slice(this.windowStart - s.startTick);
                s.startTick = this.windowStart;
            }
            for (const t of s.dayStates.keys()) if (t < this.windowStart) s.dayStates.delete(t);
        }
    }

    /** 저장할 하루 경계 상태 */
    engineDays(): EngineDays {
        return Object.fromEntries(
            this.series.map((s) => [s.def.id, [...s.dayStates.values()].toSorted((a, b) => a.tick - b.tick)]),
        );
    }

    /** `tick`의 원 단위 가격. 기록 밖의 틱이면 가장 가까운 끝 가격을 준다 */
    price(stockId: string, tick = this.tick): number {
        return roundPrice(this.rawPrice(stockId, tick));
    }

    /** `tick`의 엔진 가격(반올림 전). 아직 계산하지 않은 기록 안의 틱이면 그 종목의 기록부터 채운다 */
    rawPrice(stockId: string, tick: number): number {
        const s = this.byId.get(stockId)!;
        if (tick < s.startTick && tick >= this.windowStart) this.ensureHistory(stockId);
        return s.prices[Math.max(0, Math.min(tick - s.startTick, s.prices.length - 1))]!;
    }
}
