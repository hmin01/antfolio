import { STOCK_BY_ID } from './stocks.ts';

export const START_CASH = 10_000_000;
/** 매수가·매도가 차이. 호가창 대신 생기는 거래 비용 */
export const SPREAD = 0.001;
export const FEE_RATE = 0.00015;

export type Side = 'buy' | 'sell';

export interface Holding {
    qty: number;
    /** 수수료 제외 평균 매수 단가 */
    avgPrice: number;
    /** 현재 배당 구간 시작 틱. 첫 매수 틱부터 3시간마다 새 구간 */
    dividendSince?: number;
    /** 현재 구간에 쌓인 (보유 수량 × 보유 틱). 구간 길이로 나누면 평균 보유 수량 */
    shareTicks?: number;
}

export interface DividendPayout {
    id: string;
    stockId: string;
    /** 구간 평균 보유 수량 */
    qty: number;
    /** 배당 기준 주가 */
    price: number;
    amount: number;
    time: number;
}

/** 미체결 지정가 주문. 매수는 현금, 매도는 주식 묶음 */
export interface LimitOrder {
    id: string;
    stockId: string;
    side: Side;
    qty: number;
    limitPrice: number;
    createdAt: number;
}

export interface Trade {
    id: string;
    stockId: string;
    side: Side;
    kind: 'market' | 'limit';
    qty: number;
    price: number;
    fee: number;
    /** 매도 시 실현 손익(수수료 포함) */
    realizedPnl: number | null;
    time: number;
}

export interface Account {
    cash: number;
    holdings: Record<string, Holding>;
    orders: LimitOrder[];
    trades: Trade[];
    /** 받은 배당(최신순) */
    dividends: DividendPayout[];
    /** 배당 보유량을 마지막으로 쌓은 틱. 보유량 변경 전 재적립 필요 */
    dividendTick?: number;
}

export type OrderResult = { ok: true; account: Account; trade: Trade | null } | { ok: false; reason: string };

export const createAccount = (): Account => ({
    cash: START_CASH,
    holdings: {},
    orders: [],
    trades: [],
    dividends: [],
});

/** 한국거래소 호가 단위. 지정가 -/+ 버튼의 이동 폭 */
export function priceStep(price: number): number {
    if (price < 2_000) return 1;
    if (price < 5_000) return 5;
    if (price < 20_000) return 10;
    if (price < 50_000) return 50;
    if (price < 200_000) return 100;
    if (price < 500_000) return 500;
    return 1_000;
}

export const askPrice = (price: number) => Math.ceil(price * (1 + SPREAD / 2));
export const bidPrice = (price: number) => Math.max(1, Math.floor(price * (1 - SPREAD / 2)));
export const feeFor = (amount: number) => Math.round(amount * FEE_RATE);

/** 매수 지정가 주문에 묶인 현금. 체결가가 지정가 이하라 지정가 기준 */
const buyReserve = (qty: number, price: number) => qty * price + feeFor(qty * price);

export function availableCash(account: Account): number {
    const reserved = account.orders
        .filter((o) => o.side === 'buy')
        .reduce((sum, o) => sum + buyReserve(o.qty, o.limitPrice), 0);
    return account.cash - reserved;
}

/** 추가 매수 가능 수량. 유통 주식 수에서 보유량과 미체결 매수 수량을 뺀 값 */
export function buyableShares(account: Account, stockId: string): number {
    const pending = account.orders
        .filter((o) => o.side === 'buy' && o.stockId === stockId)
        .reduce((sum, o) => sum + o.qty, 0);
    const held = account.holdings[stockId]?.qty ?? 0;
    return Math.max(0, STOCK_BY_ID.get(stockId)!.floatShares - held - pending);
}

export function availableShares(account: Account, stockId: string): number {
    const reserved = account.orders
        .filter((o) => o.side === 'sell' && o.stockId === stockId)
        .reduce((sum, o) => sum + o.qty, 0);
    return (account.holdings[stockId]?.qty ?? 0) - reserved;
}

/** 현재 현금으로 살 수 있는 최대 수량 */
export function maxBuyQty(cash: number, price: number): number {
    let qty = Math.floor(cash / (price * (1 + FEE_RATE)));
    while (qty > 0 && buyReserve(qty, price) > cash) qty--;
    return qty;
}

function applyFill(
    account: Account,
    fill: Omit<Trade, 'id' | 'fee' | 'realizedPnl'>,
): { account: Account; trade: Trade } {
    const amount = fill.qty * fill.price;
    const fee = feeFor(amount);
    const holding = account.holdings[fill.stockId] ?? { qty: 0, avgPrice: 0 };
    const holdings = { ...account.holdings };
    let cash = account.cash;
    let realizedPnl: number | null = null;

    if (fill.side === 'buy') {
        cash -= amount + fee;
        const qty = holding.qty + fill.qty;
        holdings[fill.stockId] = { ...holding, qty, avgPrice: (holding.avgPrice * holding.qty + amount) / qty };
    } else {
        cash += amount - fee;
        realizedPnl = (fill.price - holding.avgPrice) * fill.qty - fee;
        const qty = holding.qty - fill.qty;
        if (qty === 0) delete holdings[fill.stockId];
        else holdings[fill.stockId] = { ...holding, qty };
    }

    const trade: Trade = { ...fill, id: crypto.randomUUID(), fee, realizedPnl };
    return { account: { ...account, cash, holdings, trades: [trade, ...account.trades] }, trade };
}

function validateQty(qty: number): string | null {
    if (!Number.isInteger(qty) || qty < 1) return '수량은 1주 이상 정수로 입력해 주세요';
    return null;
}

export function marketOrder(
    account: Account,
    stockId: string,
    side: Side,
    qty: number,
    price: number,
    time: number,
): OrderResult {
    const invalid = validateQty(qty);
    if (invalid) return { ok: false, reason: invalid };

    const fillPrice = side === 'buy' ? askPrice(price) : bidPrice(price);
    if (side === 'buy' && buyReserve(qty, fillPrice) > availableCash(account))
        return { ok: false, reason: '주문 가능 금액이 부족해요' };
    if (side === 'buy' && qty > buyableShares(account, stockId))
        return {
            ok: false,
            reason: `유통 주식까지만 살 수 있어요. 지금 ${buyableShares(account, stockId).toLocaleString('ko-KR')}주 더 살 수 있어요`,
        };
    if (side === 'sell' && qty > availableShares(account, stockId))
        return { ok: false, reason: '판매 가능 수량이 부족해요' };

    const { account: next, trade } = applyFill(account, { stockId, side, kind: 'market', qty, price: fillPrice, time });
    return { ok: true, account: next, trade };
}

export function placeLimitOrder(
    account: Account,
    stockId: string,
    side: Side,
    qty: number,
    limitPrice: number,
    time: number,
): OrderResult {
    const invalid = validateQty(qty);
    if (invalid) return { ok: false, reason: invalid };
    if (!Number.isInteger(limitPrice) || limitPrice < 1)
        return { ok: false, reason: '가격은 1원 이상 정수로 입력해 주세요' };
    if (side === 'buy' && buyReserve(qty, limitPrice) > availableCash(account))
        return { ok: false, reason: '주문 가능 금액이 부족해요' };
    if (side === 'buy' && qty > buyableShares(account, stockId))
        return {
            ok: false,
            reason: `유통 주식까지만 살 수 있어요. 지금 ${buyableShares(account, stockId).toLocaleString('ko-KR')}주 더 살 수 있어요`,
        };
    if (side === 'sell' && qty > availableShares(account, stockId))
        return { ok: false, reason: '판매 가능 수량이 부족해요' };

    const order: LimitOrder = { id: crypto.randomUUID(), stockId, side, qty, limitPrice, createdAt: time };
    return { ok: true, account: { ...account, orders: [...account.orders, order] }, trade: null };
}

export function cancelOrder(account: Account, orderId: string): Account {
    return { ...account, orders: account.orders.filter((o) => o.id !== orderId) };
}

/** 한 틱 가격으로 지정가 주문 체결. 매수가 ≤ 지정가인 매수, 매도가 ≥ 지정가인 매도를 그 틱 가격에 체결 */
export function fillLimitOrders(
    account: Account,
    priceOf: (stockId: string) => number,
    time: number,
): { account: Account; trades: Trade[] } {
    let next = account;
    const trades: Trade[] = [];

    for (const order of account.orders) {
        const price = priceOf(order.stockId);
        const fillPrice = order.side === 'buy' ? askPrice(price) : bidPrice(price);
        const triggered = order.side === 'buy' ? fillPrice <= order.limitPrice : fillPrice >= order.limitPrice;
        if (!triggered) continue;

        next = cancelOrder(next, order.id);
        const result = applyFill(next, {
            stockId: order.stockId,
            side: order.side,
            kind: 'limit',
            qty: order.qty,
            price: fillPrice,
            time,
        });
        next = result.account;
        trades.push(result.trade);
    }

    return { account: next, trades };
}

export function totalValue(account: Account, priceOf: (stockId: string) => number): number {
    return Object.entries(account.holdings).reduce((sum, [id, h]) => sum + h.qty * priceOf(id), account.cash);
}
