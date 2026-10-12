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

/** 자리 비움 요약을 띄우는 최소 부재 시간(5분) */
const AWAY_MIN_TICKS = 300_000 / TICK_MS;
/** 첫 접속 시 시장이 이미 열려 있던 것으로 치는 일수 */
const PREHISTORY_DAYS = 3;
/** 새 엔진 설정 적용까지의 여유 틱. 이미 본 가격 변경 방지 */
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

/** 화면을 보는 동안 배당 입금·보유 종목 배당 변경 시 잠깐 띄우는 알림 */
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

/** 배당 입금과 보유 종목 배당 공시를 한 줄로 묶은 알림 문구 */
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
 * 저장된 설정 일정을 코드의 설정 버전에 맞춤
 * - 코드에 없는 버전은 일정에서 제외(원래 계산에도 쓰일 수 없던 버전)
 * - 처음 보는 최신 버전은 1분 뒤 틱부터 적용(이미 본 가격 유지)
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
    /** 마지막 화면 확인 후 체결된 주문 */
    private unseenTrades: Trade[] = [];
    /** 마지막 화면 확인 후 받은 배당 합계 */
    private unseenDividends = 0;
    private notice: GameNotice | null = null;
    private resetting = false;

    constructor() {
        const now = Date.now();
        const raw = loadSave() ?? newSave(now);
        // 배당 기능 이전 저장에는 배당 내역 없음
        const tick = tickIndexAt(now, raw.epoch);
        const loaded = {
            ...raw,
            account: { ...raw.account, dividends: raw.account.dividends ?? [] },
            dividendPolicy: initDividendPolicy(raw.dividendPolicy, tick),
        };
        this.save = scheduleLatestVersion(loaded, tick);
        // 목록용 최근 24시간, 지정가 주문 종목은 마지막 처리 틱부터의 가격 필요
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

    /** 일정에 있지만 아직 적용 전인 설정 버전 */
    get upcomingVersion() {
        return this.save.paramSchedule.find((s) => s.fromTick > this.market.tick) ?? null;
    }

    /** 틱 경계마다 시장 진행, 탭 복귀 시 즉시 따라잡기 */
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

    /** 현재 시각까지 시장 진행 및 그동안의 지정가 주문을 틱 순서대로 체결 */
    sync = () => {
        const target = tickIndexAt(Date.now(), this.save.epoch);
        this.market.advanceTo(target);

        // 지난 자정마다 배당 공시 선처리. 이후 끝난 배당 구간을 바뀐 주당 배당금으로 계산하기 위함
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
            // 체결로 보유량이 바뀌기 전 기존 보유분으로 배당 적립
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
        // 지난 틱 주문을 모두 처리한 뒤에만 오래된 기록 삭제 가능
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

    /** 이 종목의 주당 배당금, 현재 주가 기준 배당률, 최근 공시 변화 */
    dividendOf = (stockId: string) => dividendInfo(this.policy, stockId, this.market.price(stockId));

    /** 시장가 주문 직전 현재 틱까지 배당 보유량 적립. 매 틱 sync에서 이미 쌓아 두어 보통은 변화 없음 */
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

    /** 계좌와 시장 초기화. 시장 객체 교체 대신 새로 불러오기 */
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
        // 새로고침 직전 타이머의 새 저장 덮어쓰기 방지
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
