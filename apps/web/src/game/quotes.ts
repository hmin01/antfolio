import { TICKS_PER_DAY } from '@gaemigul/queen';

import { roundPrice, type Market } from './market.ts';

const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
/** 스파크라인에 찍는 점 개수. 24시간을 30분 간격으로 나눈다 */
const SPARK_POINTS = 48;

export interface Quote {
    price: number;
    /** 24시간 전 가격 */
    basePrice: number;
    change: number;
    changeRate: number;
    /** 1시간·2시간 전 가격 대비 등락률 */
    changeRate1h: number;
    changeRate2h: number;
    /** 최근 24시간의 고가·저가 */
    high: number;
    low: number;
    /** 최근 24시간을 고르게 뽑은 가격. 마지막 값이 현재가 */
    spark: number[];
}

/** 화면에서 쓰는 "24시간 기준" 시세. 시장이 24시간 열려 있어 전일 종가 대신 24시간 전 가격과 비교한다. */
export function quoteOf(market: Market, stockId: string): Quote {
    const end = market.tick;
    const start = Math.max(market.baseTick, end - TICKS_PER_DAY);

    let high = -Infinity;
    let low = Infinity;
    for (let t = start; t <= end; t++) {
        const p = market.rawPrice(stockId, t);
        if (p > high) high = p;
        if (p < low) low = p;
    }

    const spark: number[] = [];
    for (let i = 0; i <= SPARK_POINTS; i++) {
        spark.push(market.rawPrice(stockId, Math.round(start + ((end - start) * i) / SPARK_POINTS)));
    }

    const price = market.price(stockId);
    const basePrice = market.price(stockId, start);
    const rateSince = (hours: number) => price / market.price(stockId, Math.max(0, end - hours * TICKS_PER_HOUR)) - 1;
    return {
        price,
        basePrice,
        change: price - basePrice,
        changeRate: price / basePrice - 1,
        changeRate1h: rateSince(1),
        changeRate2h: rateSince(2),
        high: roundPrice(high),
        low: roundPrice(low),
        spark,
    };
}
