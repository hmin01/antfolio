import {
    initialState,
    LATEST_VERSION,
    PARAM_VERSIONS,
    step,
    TICKS_PER_DAY,
    type EngineParams,
    type EngineState,
} from '@antfolio/queen';

import { stockParams, STOCKS, type StockDef } from './stocks.ts';

/** 틱 구간별 엔진 설정 버전(fromTick 오름차순) */
export type ParamSchedule = { versionId: string; fromTick: number }[];

/** 가격 기록 최대 보관 기간. 이보다 오래된 틱은 삭제 */
export const HISTORY_DAYS = 7;

/** 종목별 하루 경계 틱 엔진 상태(틱 오름차순). 다음 실행 시 계산 시작점 */
export type EngineDays = Record<string, EngineState[]>;

export interface StockSeries {
    def: StockDef;
    seed: number;
    /** market.tick 시점의 엔진 상태 */
    state: EngineState;
    /** prices[0]의 틱. 필요 시 windowStart까지 앞쪽 채움 */
    startTick: number;
    /** prices[i]: (startTick + i)번째 틱의 엔진 가격(반올림 전) */
    prices: number[];
    /** 기록 기간 내 하루 경계 틱 엔진 상태 */
    dayStates: Map<number, EngineState>;
    /** 설정 버전별 종목 성격을 입힌 파라미터 */
    paramsByVersion: Map<string, EngineParams>;
}

/** 화면·체결용 원 단위 가격 */
export const roundPrice = (price: number) => Math.max(1, Math.round(price));

function stockSeed(worldSeed: number, index: number): number {
    return (worldSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/** `tick` 기준 기록 보관 첫 틱. 하루 경계라 캔들 묶음 어긋남 없음 */
const windowStartFor = (tick: number) =>
    Math.max(0, Math.ceil((tick - HISTORY_DAYS * TICKS_PER_DAY) / TICKS_PER_DAY) * TICKS_PER_DAY);

/** 정렬된 상태 목록 중 `tick` 이하인 가장 늦은 상태 */
function latestAtOrBefore(states: EngineState[], tick: number): EngineState | undefined {
    for (let i = states.length - 1; i >= 0; i--) if (states[i]!.tick <= tick) return states[i];
    return undefined;
}

/**
 * 전 종목의 최근 가격 보관. 같은 worldSeed·설정 일정이면 언제 계산해도 같은 가격
 *
 * 종목별 하루 경계 엔진 상태를 저장해 두고, 열 때는 `needFrom` 직전 하루 경계부터만 계산
 * 그보다 오래된 가격(최대 HISTORY_DAYS일)은 차트 등 필요할 때 해당 종목만 계산
 */
export class Market {
    readonly series: StockSeries[];
    readonly byId: Map<string, StockSeries>;
    tick: number;
    /** 기록 보관 첫 틱 */
    windowStart: number;
    /** 앞으로 진행할 틱에만 영향을 주도록 현재 틱 이후에만 추가하는 일정 */
    schedule: ParamSchedule;

    /**
     * @param saved 저장해 둔 하루 경계 상태. 없으면 시장 시작 틱부터 계산
     * @param needFrom 종목별로 가격이 꼭 필요한 첫 틱. 그 이전은 필요 시 계산
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
            // 저장이 없으면 시장 시작부터, 저장 이후 새로 생긴 종목이면 기록 첫 틱에서 처음 가격으로 시작
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

    /** `tick`에 적용되는 설정 버전. 코드에서 사라진 버전이면 최신 버전으로 대체 */
    versionAt(tick: number): string {
        for (let i = this.schedule.length - 1; i >= 0; i--) {
            if (this.schedule[i]!.fromTick <= tick) return this.schedule[i]!.versionId;
        }
        return this.schedule[0]?.versionId ?? LATEST_VERSION.id;
    }

    /** `from` 다음 틱부터 `target` 틱까지의 가격 계산 및 지나는 하루 경계 상태 기록 */
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

    /** 이 종목 가격을 기록 기간 처음(windowStart)부터 채우기. 차트 그리기 전 호출 */
    ensureHistory(stockId: string): void {
        const s = this.byId.get(stockId)!;
        if (s.startTick <= this.windowStart) return;
        const sorted = [...s.dayStates.values()].toSorted((a, b) => a.tick - b.tick);
        const from = latestAtOrBefore(sorted, this.windowStart) ?? sorted[0]!;
        if (from.tick >= s.startTick) return;
        // compute 결과는 from 다음 틱부터 startTick까지라 앞에 from 추가, 중복 startTick 하나 제외
        const { prices } = this.compute(s, from, s.startTick);
        s.prices = [Math.exp(from.logPrice), ...prices.slice(0, -1), ...s.prices];
        s.startTick = from.tick;
    }

    /** 기록이 HISTORY_DAYS보다 길면 오래된 하루치 삭제. 지난 틱 가격으로 지정가 주문 처리 후 호출(삭제한 틱 가격은 복구 불가) */
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

    /** `tick`의 원 단위 가격. 기록 밖 틱이면 가장 가까운 끝 가격 */
    price(stockId: string, tick = this.tick): number {
        return roundPrice(this.rawPrice(stockId, tick));
    }

    /** `tick`의 엔진 가격(반올림 전). 미계산 구간이면 해당 종목 기록부터 채움 */
    rawPrice(stockId: string, tick: number): number {
        const s = this.byId.get(stockId)!;
        if (tick < s.startTick && tick >= this.windowStart) this.ensureHistory(stockId);
        return s.prices[Math.max(0, Math.min(tick - s.startTick, s.prices.length - 1))]!;
    }
}
