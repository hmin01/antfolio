export const START_CASH = 10_000_000;
/** 매수가와 매도가의 차이. 호가창이 없는 대신 사고팔 때 비용이 생기게 한다 */
export const SPREAD = 0.001;
export const FEE_RATE = 0.00015;

export type Side = 'buy' | 'sell';

export interface Holding {
    qty: number;
    /** 수수료를 뺀 평균 매수 단가 */
    avgPrice: number;
}

/** 아직 체결되지 않은 지정가 주문. 매수는 현금을, 매도는 주식을 묶어 둔다 */
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
    /** 매도일 때 실현 손익 (수수료 포함) */
    realizedPnl: number | null;
    time: number;
}

export interface Account {
    cash: number;
    holdings: Record<string, Holding>;
    orders: LimitOrder[];
    trades: Trade[];
}

export type OrderResult = { ok: true; account: Account; trade: Trade | null } | { ok: false; reason: string };

export const createAccount = (): Account => ({ cash: START_CASH, holdings: {}, orders: [], trades: [] });

/** 한국거래소 호가 단위. 지정가 입력의 -/+ 버튼이 이만큼씩 움직인다 */
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

/** 매수 지정가 주문에 묶인 현금. 체결가는 지정가 이하라 지정가 기준으로 넉넉히 잡는다 */
const buyReserve = (qty: number, price: number) => qty * price + feeFor(qty * price);

export function availableCash(account: Account): number {
    const reserved = account.orders
        .filter((o) => o.side === 'buy')
        .reduce((sum, o) => sum + buyReserve(o.qty, o.limitPrice), 0);
    return account.cash - reserved;
}

export function availableShares(account: Account, stockId: string): number {
    const reserved = account.orders
        .filter((o) => o.side === 'sell' && o.stockId === stockId)
        .reduce((sum, o) => sum + o.qty, 0);
    return (account.holdings[stockId]?.qty ?? 0) - reserved;
}

/** 지금 현금으로 살 수 있는 최대 수량 */
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
        holdings[fill.stockId] = { qty, avgPrice: (holding.avgPrice * holding.qty + amount) / qty };
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
    if (side === 'sell' && qty > availableShares(account, stockId))
        return { ok: false, reason: '매도 가능 수량이 부족해요' };

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
    if (side === 'sell' && qty > availableShares(account, stockId))
        return { ok: false, reason: '매도 가능 수량이 부족해요' };

    const order: LimitOrder = { id: crypto.randomUUID(), stockId, side, qty, limitPrice, createdAt: time };
    return { ok: true, account: { ...account, orders: [...account.orders, order] }, trade: null };
}

export function cancelOrder(account: Account, orderId: string): Account {
    return { ...account, orders: account.orders.filter((o) => o.id !== orderId) };
}

/**
 * 한 틱의 가격으로 지정가 주문을 체결한다.
 * 매수는 매수가가 지정가 이하로, 매도는 매도가가 지정가 이상으로 오면 그 틱의 가격에 체결된다.
 */
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
