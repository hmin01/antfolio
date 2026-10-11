import { initialState, step, type EngineState } from '@gaemigul/queen';
import { STOCKS, type StockDef } from './stocks.ts';

export interface StockSeries {
  def: StockDef;
  seed: number;
  state: EngineState;
  /** prices[t]는 t번째 틱의 엔진 가격(반올림 전) */
  prices: number[];
}

/** 화면과 체결에 쓰는 원 단위 가격 */
export const roundPrice = (price: number) => Math.max(1, Math.round(price));

function stockSeed(worldSeed: number, index: number): number {
  return (worldSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/**
 * 모든 종목의 가격을 시장 시작 틱부터 현재 틱까지 들고 있는다.
 * 같은 worldSeed와 epoch면 언제 계산해도 같은 가격이 나온다.
 */
export class Market {
  readonly series: StockSeries[];
  readonly byId: Map<string, StockSeries>;
  tick = 0;

  constructor(worldSeed: number, tick: number) {
    this.series = STOCKS.map((def, i) => ({
      def,
      seed: stockSeed(worldSeed, i),
      state: initialState(def.initialPrice, def.params),
      prices: [def.initialPrice],
    }));
    this.byId = new Map(this.series.map((s) => [s.def.id, s]));
    this.advanceTo(tick);
  }

  advanceTo(target: number): void {
    if (target <= this.tick) return;
    for (const s of this.series) {
      while (s.state.tick < target) {
        s.state = step(s.state, s.def.params, s.seed);
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
