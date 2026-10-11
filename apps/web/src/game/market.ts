import { initialState, LATEST_VERSION, PARAM_VERSIONS, step, type EngineParams, type EngineState } from '@gaemigul/queen';
import { STOCKS, stockParams, type StockDef } from './stocks.ts';

/** 어떤 틱부터 어떤 엔진 설정 버전을 쓰는지. fromTick 오름차순 */
export type ParamSchedule = { versionId: string; fromTick: number }[];

export interface StockSeries {
  def: StockDef;
  seed: number;
  state: EngineState;
  /** prices[t]는 t번째 틱의 엔진 가격(반올림 전) */
  prices: number[];
  /** 설정 버전별로 종목 성격을 입힌 파라미터 */
  paramsByVersion: Map<string, EngineParams>;
}

/** 화면과 체결에 쓰는 원 단위 가격 */
export const roundPrice = (price: number) => Math.max(1, Math.round(price));

function stockSeed(worldSeed: number, index: number): number {
  return (worldSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/**
 * 모든 종목의 가격을 시장 시작 틱부터 현재 틱까지 들고 있는다.
 * 같은 worldSeed와 설정 일정이면 언제 계산해도 같은 가격이 나온다.
 */
export class Market {
  readonly series: StockSeries[];
  readonly byId: Map<string, StockSeries>;
  tick = 0;
  /** 앞으로 진행할 틱에만 영향을 주도록, 일정은 현재 틱 이후에만 추가한다 */
  schedule: ParamSchedule;

  constructor(worldSeed: number, schedule: ParamSchedule, tick: number) {
    this.schedule = schedule;
    this.series = STOCKS.map((def, i) => {
      const paramsByVersion = new Map(PARAM_VERSIONS.map((v) => [v.id, stockParams(v.params, def.personality)]));
      return {
        def,
        seed: stockSeed(worldSeed, i),
        state: initialState(def.initialPrice, this.paramsAt(paramsByVersion, 0)),
        prices: [def.initialPrice],
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
      }
    }
    this.tick = target;
  }

  price(stockId: string, tick = this.tick): number {
    const prices = this.byId.get(stockId)!.prices;
    return roundPrice(prices[Math.max(0, Math.min(tick, prices.length - 1))]!);
  }
}
