import { tickIndexAt, tickStartTime } from '@gaemigul/queen';
import { useSyncExternalStore } from 'react';
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
import { Market } from './market.ts';
import { loadSave, writeSave, type SaveData } from './storage.ts';

/** 이 틱 수(5분) 이상 자리를 비웠다 돌아오면 요약을 보여준다 */
const AWAY_MIN_TICKS = 20;
/** 처음 접속하면 며칠 전부터 시장이 열려 있던 것으로 만든다 */
const PREHISTORY_DAYS = 3;

export interface AwayReport {
  fromTick: number;
  toTick: number;
  beforeValue: number;
  afterValue: number;
  trades: Trade[];
}

export interface GameSnapshot {
  tick: number;
  account: Account;
  away: AwayReport | null;
}

function newSave(now: number): SaveData {
  const today = new Date(now);
  const epoch = new Date(today.getFullYear(), today.getMonth(), today.getDate() - PREHISTORY_DAYS).getTime();
  const tick = tickIndexAt(now, epoch);
  return {
    version: 1,
    worldSeed: crypto.getRandomValues(new Uint32Array(1))[0]!,
    epoch,
    account: createAccount(),
    processedTick: tick,
    lastSeenTick: tick,
    lastSeenValue: START_CASH,
  };
}

class GameStore {
  readonly market: Market;
  private save: SaveData;
  private snapshot: GameSnapshot;
  private listeners = new Set<() => void>();
  /** 마지막으로 화면을 본 뒤에 체결된 주문 */
  private unseenTrades: Trade[] = [];
  private resetting = false;

  constructor() {
    const now = Date.now();
    this.save = loadSave() ?? newSave(now);
    this.market = new Market(this.save.worldSeed, tickIndexAt(now, this.save.epoch));
    this.snapshot = { tick: this.market.tick, account: this.save.account, away: null };
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

  /** 다음 틱 경계마다 시장을 진행하고, 탭으로 돌아오면 바로 따라잡는다. */
  start() {
    const schedule = () => {
      const next = tickStartTime(this.market.tick + 1, this.save.epoch);
      window.setTimeout(() => {
        this.sync();
        schedule();
      }, Math.max(0, next - Date.now()) + 50);
    };
    schedule();
    document.addEventListener('visibilitychange', this.sync);
  }

  /** 현재 시각까지 시장을 진행하고, 그동안의 지정가 주문을 틱 순서대로 체결한다. */
  sync = () => {
    const target = tickIndexAt(Date.now(), this.save.epoch);
    this.market.advanceTo(target);

    let account = this.save.account;
    for (let t = this.save.processedTick + 1; t <= target && account.orders.length > 0; t++) {
      const result = fillLimitOrders(account, (id) => this.market.price(id, t), tickStartTime(t, this.save.epoch));
      account = result.account;
      this.unseenTrades.push(...result.trades);
    }

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
        };
      }
      this.unseenTrades = [];
      this.save = { ...this.save, lastSeenTick: target, lastSeenValue: value };
    }

    this.commit({ ...this.save, account, processedTick: target }, away);
  };

  dismissAway = () => {
    this.snapshot = { ...this.snapshot, away: null };
    this.emit();
  };

  marketOrder = (stockId: string, side: Side, qty: number): OrderResult =>
    this.apply(marketOrder(this.save.account, stockId, side, qty, this.market.price(stockId), Date.now()));

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
    this.save = save;
    writeSave(save);
    this.snapshot = { tick: this.market.tick, account: save.account, away };
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
