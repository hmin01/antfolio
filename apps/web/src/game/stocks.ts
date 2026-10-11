import { DEFAULT_PARAMS, REGIMES, type EngineParams } from '@gaemigul/queen';

export interface StockDef {
  id: string;
  name: string;
  sector: string;
  initialPrice: number;
  params: EngineParams;
}

interface Personality {
  /** 기본 변동성 배율 */
  vol?: number;
  /** 국면별 추세 배율 */
  trend?: number;
  /** 급등락 빈도 배율 */
  jumps?: number;
  tailDf?: number;
}

/** 기본 엔진 파라미터에 종목 성격을 입힌다. */
function personality({ vol = 1, trend = 1, jumps = 1, tailDf }: Personality): EngineParams {
  const base = DEFAULT_PARAMS;
  const regimes = Object.fromEntries(
    REGIMES.map((r) => [r, { ...base.regimes[r], driftPerDay: base.regimes[r].driftPerDay * trend }]),
  ) as EngineParams['regimes'];

  return {
    ...base,
    dailyVol: base.dailyVol * vol,
    regimes,
    jumps: { perDay: base.jumps.perDay * jumps, size: base.jumps.size * Math.sqrt(vol) },
    tailDf: tailDf ?? base.tailDf,
  };
}

export const STOCKS: StockDef[] = [
  { id: 'gmj', name: '개미전자', sector: '반도체', initialPrice: 52_000, params: personality({ vol: 0.6, trend: 0.6, jumps: 0.5 }) },
  { id: 'ywb', name: '여왕바이오', sector: '바이오', initialPrice: 18_400, params: personality({ vol: 1.8, jumps: 2.5, tailDf: 3 }) },
  { id: 'igc', name: '일개미건설', sector: '건설', initialPrice: 7_300, params: personality({ vol: 0.9 }) },
  { id: 'gds', name: '꿀단지식품', sector: '식품', initialPrice: 31_500, params: personality({ vol: 0.5, trend: 0.5, jumps: 0.3 }) },
  { id: 'dgt', name: '땅굴통신', sector: '통신', initialPrice: 12_800, params: personality({ vol: 0.7 }) },
  { id: 'prm', name: '페로몬화학', sector: '화학', initialPrice: 96_000, params: personality({ vol: 1.1, trend: 1.2 }) },
  { id: 'ddm', name: '더듬이모빌리티', sector: '자동차', initialPrice: 24_600, params: personality({ vol: 1.3, trend: 1.4 }) },
  { id: 'hde', name: '흙더미에너지', sector: '에너지', initialPrice: 4_150, params: personality({ vol: 1.5, jumps: 1.5 }) },
];

export const STOCK_BY_ID = new Map(STOCKS.map((s) => [s.id, s]));
