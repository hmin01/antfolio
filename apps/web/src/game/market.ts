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

/** 가격 기록을 들고 있는 최대 기간. 그보다 오래된 틱은 버리고, 그 시점의 엔진 상태만 남긴다 */
export const HISTORY_DAYS = 14;

/** 기록의 첫 틱과 그때의 종목별 엔진 상태. 저장해 두면 다음에 열 때 여기서부터 계산한다 */
export interface MarketSnapshot {
    tick: number;
    states: Record<string, EngineState>;
}

export interface StockSeries {
    def: StockDef;
    seed: number;
    state: EngineState;
    /** prices[i]는 (market.baseTick + i)번째 틱의 엔진 가격(반올림 전) */
    prices: number[];
    /** 하루 경계 틱의 엔진 상태. 오래된 기록을 버릴 때 새 시작점이 된다 */
    dayStates: Map<number, EngineState>;
    /** 설정 버전별로 종목 성격을 입힌 파라미터 */
    paramsByVersion: Map<string, EngineParams>;
}

/** 화면과 체결에 쓰는 원 단위 가격 */
export const roundPrice = (price: number) => Math.max(1, Math.round(price));

function stockSeed(worldSeed: number, index: number): number {
    return (worldSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/**
 * 모든 종목의 최근 가격을 들고 있는다. 같은 worldSeed와 설정 일정이면 언제 계산해도 같은 가격이 나온다.
 *
 * 처음에는 시장 시작 틱부터 계산하고, 기록이 HISTORY_DAYS를 넘으면 오래된 하루치씩 버린다.
 * 버린 시점의 엔진 상태(snapshot)를 저장해 두면 다음에 열 때 그 틱부터만 계산하면 된다.
 */
export class Market {
    readonly series: StockSeries[];
    readonly byId: Map<string, StockSeries>;
    /** prices[0]에 해당하는 틱. 늘 하루 경계라 캔들 묶음이 어긋나지 않는다 */
    baseTick: number;
    tick: number;
    snapshot: MarketSnapshot | null;
    /** 앞으로 진행할 틱에만 영향을 주도록, 일정은 현재 틱 이후에만 추가한다 */
    schedule: ParamSchedule;

    constructor(worldSeed: number, schedule: ParamSchedule, tick: number, snapshot: MarketSnapshot | null = null) {
        this.schedule = schedule;
        this.snapshot = snapshot;
        this.baseTick = snapshot?.tick ?? 0;
        this.tick = this.baseTick;
        this.series = STOCKS.map((def, i) => {
            const paramsByVersion = new Map(PARAM_VERSIONS.map((v) => [v.id, stockParams(v.params, def.personality)]));
            // 저장 뒤에 새로 생긴 종목은 기록의 첫 틱에서 처음 가격으로 시작한다.
            const state = snapshot?.states[def.id] ?? {
                ...initialState(def.initialPrice, this.paramsAt(paramsByVersion, this.baseTick)),
                tick: this.baseTick,
            };
            return {
                def,
                seed: stockSeed(worldSeed, i),
                state,
                prices: [Math.exp(state.logPrice)],
                dayStates: new Map([[this.baseTick, state]]),
                paramsByVersion,
            };
        });
        this.byId = new Map(this.series.map((s) => [s.def.id, s]));
        this.advanceTo(tick);
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

    advanceTo(target: number): void {
        if (target <= this.tick) return;
        for (const s of this.series) {
            while (s.state.tick < target) {
                s.state = step(s.state, this.paramsAt(s.paramsByVersion, s.state.tick + 1), s.seed);
                s.prices.push(Math.exp(s.state.logPrice));
                if (s.state.tick % TICKS_PER_DAY === 0) s.dayStates.set(s.state.tick, s.state);
            }
        }
        this.tick = target;
    }

    /**
     * 기록이 HISTORY_DAYS보다 길면 오래된 하루치를 버리고 snapshot을 새 시작점으로 옮긴다.
     * 지난 틱의 가격으로 지정가 주문을 처리한 뒤에 부른다. 버린 틱의 가격은 다시 볼 수 없다.
     * @returns snapshot이 바뀌었으면 true
     */
    trimHistory(): boolean {
        const newBase = Math.ceil((this.tick - HISTORY_DAYS * TICKS_PER_DAY) / TICKS_PER_DAY) * TICKS_PER_DAY;
        if (newBase <= this.baseTick) return false;

        const states: Record<string, EngineState> = {};
        for (const s of this.series) {
            s.prices = s.prices.slice(newBase - this.baseTick);
            states[s.def.id] = s.dayStates.get(newBase)!;
            for (const t of s.dayStates.keys()) if (t < newBase) s.dayStates.delete(t);
        }
        this.baseTick = newBase;
        this.snapshot = { tick: newBase, states };
        return true;
    }

    /** `tick`의 원 단위 가격. 기록 밖의 틱이면 가장 가까운 끝 가격을 준다 */
    price(stockId: string, tick = this.tick): number {
        return roundPrice(this.rawPrice(stockId, tick));
    }

    /** `tick`의 엔진 가격(반올림 전). 기록 밖의 틱이면 가장 가까운 끝 가격을 준다 */
    rawPrice(stockId: string, tick: number): number {
        const prices = this.byId.get(stockId)!.prices;
        return prices[Math.max(0, Math.min(tick - this.baseTick, prices.length - 1))]!;
    }
}
