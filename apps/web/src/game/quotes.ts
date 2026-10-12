import { TICKS_PER_DAY } from '@antfolio/queen';

import { roundPrice, type Market } from './market.ts';
import { STOCK_BY_ID } from './stocks.ts';

const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
/** 목록 흐름 차트의 기간과 점 개수(3시간, 5분 간격) */
const SPARK_HOURS = 3;
const SPARK_POINTS = 36;

export interface Quote {
    price: number;
    /** 24시간 전 가격 */
    basePrice: number;
    change: number;
    changeRate: number;
    /** 1시간·3시간 전 대비 등락률 */
    changeRate1h: number;
    changeRate3h: number;
    price3hAgo: number;
    /** 최근 24시간 고가·저가 */
    high: number;
    low: number;
    /** 최근 3시간 균등 표본 가격. 마지막 값이 현재가 */
    spark: number[];
    /** 시가총액(발행 주식 수 × 현재가) */
    marketCap: number;
}

/** 화면용 24시간 기준 시세. 24시간 장이라 전일 종가 대신 24시간 전 가격과 비교 */
export function quoteOf(market: Market, stockId: string): Quote {
    const end = market.tick;
    const start = Math.max(market.windowStart, end - TICKS_PER_DAY);

    let high = -Infinity;
    let low = Infinity;
    for (let t = start; t <= end; t++) {
        const p = market.rawPrice(stockId, t);
        if (p > high) high = p;
        if (p < low) low = p;
    }

    const sparkStart = Math.max(market.windowStart, end - SPARK_HOURS * TICKS_PER_HOUR);
    const spark: number[] = [];
    for (let i = 0; i <= SPARK_POINTS; i++) {
        spark.push(market.rawPrice(stockId, Math.round(sparkStart + ((end - sparkStart) * i) / SPARK_POINTS)));
    }

    const price = market.price(stockId);
    const basePrice = market.price(stockId, start);
    const priceAgo = (hours: number) =>
        market.price(stockId, Math.max(market.windowStart, end - hours * TICKS_PER_HOUR));
    const price3hAgo = priceAgo(3);
    return {
        price,
        basePrice,
        change: price - basePrice,
        changeRate: price / basePrice - 1,
        changeRate1h: price / priceAgo(1) - 1,
        changeRate3h: price / price3hAgo - 1,
        price3hAgo,
        high: roundPrice(high),
        low: roundPrice(low),
        spark,
        marketCap: STOCK_BY_ID.get(stockId)!.shares * price,
    };
}
