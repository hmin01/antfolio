import { TICK_MS, TICKS_PER_DAY } from '@antfolio/queen';

import type { Account, DividendPayout, Holding } from './account.ts';
import { STOCK_BY_ID, STOCKS } from './stocks.ts';

/** 배당 구간 길이. 첫 매수 틱부터 이 간격마다 배당 */
export const DIVIDEND_PERIOD_TICKS = (3 * 3_600_000) / TICK_MS;
/** 실제 배당률 상한. 주가 급락 시에도 평가금액의 이 비율까지만 지급 */
export const MAX_DIVIDEND_YIELD = 0.09;
/** 배당 공시 1회당 주당 배당금 최대 변동 비율 */
const MAX_ANNOUNCE_STEP = 0.2;
/** 24시간 주가 등락 대비 주당 배당금 변화 배율(주가 +5% → 배당 +10%) */
const ANNOUNCE_SENSITIVITY = 2;
/** 처음 주당 배당금 대비 허용 범위 */
const DPS_MIN_RATIO = 0.5;
const DPS_MAX_RATIO = 2;
/** 종목별 보관 배당 공시 개수. 자리 비운 동안의 지급 계산에 충분한 만큼 */
const KEEP_ANNOUNCEMENTS = 10;
/** 계좌에 보관하는 배당 내역 개수 */
const KEEP_PAYOUTS = 200;

/** 배당 공시. 이 틱부터 주당 배당금 dps원 */
export interface DividendAnnouncement {
    tick: number;
    dps: number;
}

/** 종목별 배당 공시 기록(틱 오름차순) */
export type DividendPolicy = Record<string, DividendAnnouncement[]>;

/** 주당 배당금이 바뀐 공시(알림용) */
export interface DividendChange {
    stockId: string;
    from: number;
    to: number;
}

type PriceAt = (stockId: string, tick: number) => number;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const baseDps = (stockId: string) => {
    const stock = STOCK_BY_ID.get(stockId)!;
    return Math.max(1, Math.round(stock.initialPrice * stock.dividendRate));
};
const dayStart = (tick: number) => Math.floor(tick / TICKS_PER_DAY) * TICKS_PER_DAY;

/** 공시 기록이 없는 종목(첫 시작, 신규 종목)은 오늘 자정에 기본 주당 배당금으로 시작 */
export function initDividendPolicy(policy: DividendPolicy | undefined, tick: number): DividendPolicy {
    const next: DividendPolicy = { ...policy };
    for (const stock of STOCKS) {
        if (!next[stock.id]?.length) next[stock.id] = [{ tick: dayStart(tick), dps: baseDps(stock.id) }];
    }
    return next;
}

/** `tick`에 적용되는 주당 배당금 */
export function dpsAt(policy: DividendPolicy, stockId: string, tick: number): number {
    const list = policy[stockId]!;
    for (let i = list.length - 1; i >= 0; i--) if (list[i]!.tick <= tick) return list[i]!.dps;
    return list[0]!.dps;
}

/** 마지막 공시 다음 자정부터 `tick`까지 자정마다 배당 공시. 지난 24시간 주가 등락에 따라 주당 배당금 증감(가격 기록만으로 결정되어 언제 계산해도 동일) */
export function announceDividends(
    policy: DividendPolicy,
    tick: number,
    priceAt: PriceAt,
): { policy: DividendPolicy; changes: DividendChange[] } {
    const next: DividendPolicy = {};
    const changes: DividendChange[] = [];
    for (const [stockId, list] of Object.entries(policy)) {
        const updated = [...list];
        const base = baseDps(stockId);
        let last = updated.at(-1)!;
        for (let day = last.tick + TICKS_PER_DAY; day <= tick; day += TICKS_PER_DAY) {
            const change = priceAt(stockId, day) / priceAt(stockId, day - TICKS_PER_DAY) - 1;
            const step = clamp(change * ANNOUNCE_SENSITIVITY, -MAX_ANNOUNCE_STEP, MAX_ANNOUNCE_STEP);
            const dps = clamp(
                Math.round(last.dps * (1 + step)),
                Math.max(1, Math.round(base * DPS_MIN_RATIO)),
                Math.round(base * DPS_MAX_RATIO),
            );
            if (dps !== last.dps) changes.push({ stockId, from: last.dps, to: dps });
            last = { tick: day, dps };
            updated.push(last);
        }
        next[stockId] = updated.slice(-KEEP_ANNOUNCEMENTS);
    }
    return { policy: next, changes };
}

/** 주당 배당금과 주가로 정한 1주 배당. 실제 배당률은 MAX_DIVIDEND_YIELD 이하 */
const perShare = (dps: number, price: number) => Math.min(dps, price * MAX_DIVIDEND_YIELD);

/** 현재 주가 기준 배당률과 최근 공시 변화 */
export function dividendInfo(policy: DividendPolicy, stockId: string, price: number) {
    const list = policy[stockId]!;
    const current = list.at(-1)!;
    const previous = list.at(-2);
    return {
        dps: current.dps,
        yield: perShare(current.dps, price) / price,
        capped: current.dps > price * MAX_DIVIDEND_YIELD,
        /** 마지막 공시의 주당 배당금 변화율. 공시가 1회뿐이면 0 */
        lastChange: previous ? current.dps / previous.dps - 1 : 0,
        announcedAt: current.tick,
    };
}

/**
 * `tick`까지 보유량 적립 및 그 사이 끝난 배당 구간 정산
 *
 * 보유량 변경 직전(주문 체결 전)마다 호출 필요. 구간 보유량을 시간 비례로 계산하기 위함
 * 중간 매수분은 보유 시간만큼만, 전량 매도한 종목은 미완료 구간 미지급
 * 배당은 구간 종료 틱의 주당 배당금과 주가 기준
 */
export function accrueDividends(
    account: Account,
    tick: number,
    policy: DividendPolicy,
    priceAt: PriceAt,
    timeAt: (tick: number) => number,
): { account: Account; payouts: DividendPayout[] } {
    // 배당 기능 이전 계좌는 지금부터 적립
    const last = account.dividendTick ?? tick;
    if (tick <= last && account.dividendTick !== undefined) return { account, payouts: [] };

    const payouts: DividendPayout[] = [];
    const holdings: Record<string, Holding> = {};
    for (const [stockId, h] of Object.entries(account.holdings)) {
        let since = h.dividendSince ?? last;
        let shareTicks = h.shareTicks ?? 0;
        let cursor = last;

        while (since + DIVIDEND_PERIOD_TICKS <= tick) {
            const end = since + DIVIDEND_PERIOD_TICKS;
            shareTicks += h.qty * (end - cursor);
            const qty = shareTicks / DIVIDEND_PERIOD_TICKS;
            const price = priceAt(stockId, end);
            const amount = Math.round(qty * perShare(dpsAt(policy, stockId, end), price));
            if (amount > 0) {
                payouts.push({ id: crypto.randomUUID(), stockId, qty, price, amount, time: timeAt(end) });
            }
            shareTicks = 0;
            cursor = end;
            since = end;
        }
        shareTicks += h.qty * (tick - cursor);
        holdings[stockId] = { ...h, dividendSince: since, shareTicks };
    }

    payouts.sort((a, b) => a.time - b.time);
    const total = payouts.reduce((sum, p) => sum + p.amount, 0);
    return {
        account: {
            ...account,
            cash: account.cash + total,
            holdings,
            dividends: [...payouts.toReversed(), ...account.dividends].slice(0, KEEP_PAYOUTS),
            dividendTick: tick,
        },
        payouts,
    };
}

/** 다음 배당까지 남은 틱과 예상 배당(현재 수량·주당 배당금·주가 유지 가정) */
export function nextDividend(
    holding: Holding,
    accountTick: number,
    tick: number,
    dps: number,
    price: number,
): { ticksLeft: number; expected: number } {
    const since = holding.dividendSince ?? accountTick;
    const end = since + DIVIDEND_PERIOD_TICKS;
    const shareTicks = (holding.shareTicks ?? 0) + holding.qty * (end - Math.max(accountTick, since));
    return {
        ticksLeft: Math.max(0, end - tick),
        expected: Math.round((shareTicks / DIVIDEND_PERIOD_TICKS) * perShare(dps, price)),
    };
}
