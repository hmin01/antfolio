import { useSyncExternalStore } from 'react';

import { LATEST_VERSION, PARAM_VERSIONS, TICK_MS, tickIndexAt, TICKS_PER_DAY, tickStartTime } from '@antfolio/queen';

import { num } from '../format.ts';
import {
    cancelOrder,
    createAccount,
    fillLimitOrders,
    marketOrder,
    placeLimitOrder,
    START_CASH,
    totalValue,
    type Account,
    type OrderResult,
    type Side,
    type Trade,
} from './account.ts';
import {
    accrueDividends,
    announceDividends,
    dividendInfo,
    initDividendPolicy,
    type DividendPolicy,
} from './dividends.ts';
import { Market } from './market.ts';
import { STOCK_BY_ID } from './stocks.ts';
import { loadSave, writeSave, type SaveData } from './storage.ts';

/** 5분 이상 자리를 비웠다 돌아오면 요약을 보여준다 */
const AWAY_MIN_TICKS = 300_000 / TICK_MS;
/** 처음 접속하면 며칠 전부터 시장이 열려 있던 것으로 만든다 */
const PREHISTORY_DAYS = 3;
/** 새 엔진 설정을 발견하면 이만큼 뒤의 틱부터 적용한다. 이미 본 가격이 바뀌지 않게 하는 여유 */
const NEW_VERSION_DELAY_TICKS = 60_000 / TICK_MS;

export interface AwayReport {
    fromTick: number;
    toTick: number;
    beforeValue: number;
    afterValue: number;
    trades: Trade[];
    /** 자리 비운 동안 받은 배당 합계 */
    dividends: number;
}

/** 화면을 보는 동안 배당이 들어오거나 보유 종목의 배당이 바뀌면 잠깐 띄우는 알림 */
export interface GameNotice {
    id: string;
    text: string;
}

export interface GameSnapshot {
    tick: number;
    account: Account;
    away: AwayReport | null;
    notice: GameNotice | null;
}

/** 알림 문구. 배당 입금과 보유 종목의 배당 공시를 한 줄로 묶는다 */
function noticeText(dividends: number, payoutCount: number, changes: { stockId: string; from: number; to: number }[]) {
    const parts: string[] = [];
    if (dividends > 0) {
        parts.push(`💰 배당금 ${num(dividends)}원이 들어왔어요${payoutCount > 1 ? ` (${payoutCount}건)` : ''}`);
    }
    if (changes.length > 0) {
        const first = changes[0]!;
        const rate = Math.round((first.to / first.from - 1) * 100);
        const others = changes.length > 1 ? ` 외 ${changes.length - 1}종목` : '';
        parts.push(
            `📢 ${STOCK_BY_ID.get(first.stockId)!.name} 배당 ${rate > 0 ? '▲' : '▼'}${Math.abs(rate)}%${others}`,
        );
    }
    return parts.join(' · ');
}

function newSave(now: number): SaveData {
    const today = new Date(now);
    const epoch = new Date(today.getFullYear(), today.getMonth(), today.getDate() - PREHISTORY_DAYS).getTime();
    const tick = tickIndexAt(now, epoch);
    return {
        version: 2,
        worldSeed: crypto.getRandomValues(new Uint32Array(1))[0]!,
        epoch,
        paramSchedule: [{ versionId: LATEST_VERSION.id, fromTick: 0 }],
        account: createAccount(),
        processedTick: tick,
        lastSeenTick: tick,
        lastSeenValue: START_CASH,
    };
}

/**
 * 저장된 설정 일정을 코드의 설정 버전에 맞춘다.
 * - 코드에 없는 버전은 일정에서 뺀다. 그 버전은 원래 계산에도 쓰일 수 없었다.
 * - 처음 보는 최신 버전은 지금부터 1분 뒤 틱부터 적용한다. 이미 지나간 틱은 예전 설정 그대로라 본 적 있는 가격이 바뀌지 않는다.
 */
function scheduleLatestVersion(save: SaveData, tick: number): SaveData {
    const known = new Set(PARAM_VERSIONS.map((v) => v.id));
    let schedule = save.paramSchedule.filter((s) => known.has(s.versionId));
    if (schedule.length === 0) schedule = [{ versionId: PARAM_VERSIONS[0]!.id, fromTick: 0 }];
    if (!schedule.some((s) => s.versionId === LATEST_VERSION.id)) {
        schedule = [...schedule, { versionId: LATEST_VERSION.id, fromTick: tick + NEW_VERSION_DELAY_TICKS }];
    }
    return { ...save, paramSchedule: schedule };
}

class GameStore {
    readonly market: Market;
    private save: SaveData;
    private snapshot: GameSnapshot;
    private listeners = new Set<() => void>();
    /** 마지막으로 화면을 본 뒤에 체결된 주문 */
    private unseenTrades: Trade[] = [];
    /** 마지막으로 화면을 본 뒤에 받은 배당 합계 */
    private unseenDividends = 0;
    private notice: GameNotice | null = null;
    private resetting = false;

    constructor() {
        const now = Date.now();
        const raw = loadSave() ?? newSave(now);
        // 배당 기능 전의 저장에는 배당 내역이 없다.
        const tick = tickIndexAt(now, raw.epoch);
        const loaded = {
            ...raw,
            account: { ...raw.account, dividends: raw.account.dividends ?? [] },
            dividendPolicy: initDividendPolicy(raw.dividendPolicy, tick),
        };
        this.save = scheduleLatestVersion(loaded, tick);
        // 목록에는 최근 24시간이, 지정가 주문이 걸린 종목은 마지막으로 처리한 틱부터의 가격이 필요하다.
        const { account, processedTick } = this.save;
        const ordered = new Set(account.orders.map((o) => o.stockId));
        this.market = new Market(
            this.save.worldSeed,
            this.save.paramSchedule,
            tick,
            this.save.engineDays ?? null,
            (id) => (ordered.has(id) ? Math.min(processedTick, tick - TICKS_PER_DAY) : tick - TICKS_PER_DAY),
        );
        this.snapshot = { tick: this.market.tick, account: this.save.account, away: null, notice: null };
        this.sync();
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = () => this.snapshot;

    get epoch() {
        return this.save.epoch;
    }

    /** 일정에 들어갔지만 아직 적용되기 전인 설정 버전 */
    get upcomingVersion() {
        return this.save.paramSchedule.find((s) => s.fromTick > this.market.tick) ?? null;
    }

    /** 다음 틱 경계마다 시장을 진행하고, 탭으로 돌아오면 바로 따라잡는다. */
    start() {
        const schedule = () => {
            const next = tickStartTime(this.market.tick + 1, this.save.epoch);
            window.setTimeout(
                () => {
                    this.sync();
                    schedule();
                },
                Math.max(0, next - Date.now()) + 50,
            );
        };
        schedule();
        document.addEventListener('visibilitychange', this.sync);
    }

    /** 현재 시각까지 시장을 진행하고, 그동안의 지정가 주문을 틱 순서대로 체결한다. */
    sync = () => {
        const target = tickIndexAt(Date.now(), this.save.epoch);
        this.market.advanceTo(target);

        // 지나간 자정마다 배당을 공시해 두어야, 그 뒤에 끝난 배당 구간을 바뀐 주당 배당금으로 계산할 수 있다.
        const announced = announceDividends(this.policy, target, (id, at) => this.market.rawPrice(id, at));
        const policy = announced.policy;

        let account = this.save.account;
        let dividends = 0;
        let dividendCount = 0;
        const accrue = (t: number) => {
            const result = accrueDividends(
                account,
                t,
                policy,
                (id, at) => this.market.price(id, at),
                (at) => tickStartTime(at, this.save.epoch),
            );
            account = result.account;
            for (const p of result.payouts) dividends += p.amount;
            dividendCount += result.payouts.length;
        };
        for (let t = this.save.processedTick + 1; t <= target && account.orders.length > 0; t++) {
            // 체결로 보유량이 바뀌기 전에 그때까지의 보유분으로 배당을 쌓는다.
            accrue(t);
            const result = fillLimitOrders(
                account,
                (id) => this.market.price(id, t),
                tickStartTime(t, this.save.epoch),
            );
            account = result.account;
            this.unseenTrades.push(...result.trades);
        }
        accrue(target);
        this.unseenDividends += dividends;
        // 지난 틱으로 주문을 다 처리한 뒤에야 오래된 기록을 버릴 수 있다.
        this.market.trimHistory();

        let away = this.snapshot.away;
        const value = totalValue(account, (id) => this.market.price(id, target));
        if (document.visibilityState === 'visible') {
            if (target - this.save.lastSeenTick >= AWAY_MIN_TICKS) {
                away = {
                    fromTick: this.save.lastSeenTick,
                    toTick: target,
                    beforeValue: this.save.lastSeenValue,
                    afterValue: value,
                    trades: this.unseenTrades,
                    dividends: this.unseenDividends,
                };
            } else {
                const heldChanges = announced.changes.filter((c) => c.stockId in account.holdings);
                if (dividends > 0 || heldChanges.length > 0) {
                    this.notice = { id: crypto.randomUUID(), text: noticeText(dividends, dividendCount, heldChanges) };
                }
            }
            this.unseenTrades = [];
            this.unseenDividends = 0;
            this.save = { ...this.save, lastSeenTick: target, lastSeenValue: value };
        }

        this.commit({ ...this.save, account, processedTick: target, dividendPolicy: policy }, away);
    };

    dismissAway = () => {
        this.snapshot = { ...this.snapshot, away: null };
        this.emit();
    };

    dismissNotice = () => {
        this.notice = null;
        this.snapshot = { ...this.snapshot, notice: null };
        this.emit();
    };

    private get policy(): DividendPolicy {
        return this.save.dividendPolicy!;
    }

    /** 이 종목의 주당 배당금, 지금 주가 기준 배당률, 최근 공시 변화 */
    dividendOf = (stockId: string) => dividendInfo(this.policy, stockId, this.market.price(stockId));

    /**
     * 시장가 주문은 보유량을 바로 바꾸므로, 그 전에 지금 틱까지 배당 보유량을 쌓는다.
     * 매 틱 sync에서 이미 쌓아 두므로 보통은 바뀌는 것이 없다.
     */
    marketOrder = (stockId: string, side: Side, qty: number): OrderResult => {
        const { account } = accrueDividends(
            this.save.account,
            this.market.tick,
            this.policy,
            (id, at) => this.market.price(id, at),
            (at) => tickStartTime(at, this.save.epoch),
        );
        return this.apply(marketOrder(account, stockId, side, qty, this.market.price(stockId), Date.now()));
    };

    placeLimitOrder = (stockId: string, side: Side, qty: number, limitPrice: number): OrderResult =>
        this.apply(placeLimitOrder(this.save.account, stockId, side, qty, limitPrice, Date.now()));

    cancelOrder = (orderId: string) => {
        this.commit({ ...this.save, account: cancelOrder(this.save.account, orderId) }, this.snapshot.away);
    };

    /** 계좌와 시장을 모두 새로 만든다. 시장 객체를 갈아끼우는 대신 새로 불러온다. */
    reset = () => {
        this.resetting = true;
        writeSave(newSave(Date.now()));
        location.reload();
    };

    private apply(result: OrderResult): OrderResult {
        if (result.ok) this.commit({ ...this.save, account: result.account }, this.snapshot.away);
        return result;
    }

    private commit(save: SaveData, away: AwayReport | null) {
        // 새로고침 직전에 타이머가 돌아도 새 저장을 덮어쓰지 않게 한다.
        if (this.resetting) return;
        this.save = { ...save, engineDays: this.market.engineDays() };
        writeSave(this.save);
        this.snapshot = { tick: this.market.tick, account: save.account, away, notice: this.notice };
        this.emit();
    }

    private emit() {
        for (const listener of this.listeners) listener();
    }
}

export const game = new GameStore();

export function useGame(): GameSnapshot {
    return useSyncExternalStore(game.subscribe, game.getSnapshot);
}
