import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { num, won } from '../format.ts';
import {
    askPrice,
    availableCash,
    availableShares,
    bidPrice,
    feeFor,
    maxBuyQty,
    priceStep,
    type Side,
} from '../game/account.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';

type Kind = 'limit' | 'market';

const SIDE_STYLE: Record<Side, { label: string; tab: string; button: string }> = {
    buy: { label: '구매', tab: 'aria-selected:text-up', button: 'bg-up hover:brightness-95' },
    sell: { label: '판매', tab: 'aria-selected:text-down', button: 'bg-down hover:brightness-95' },
};

const RATIOS = [0.1, 0.25, 0.5, 1] as const;

const toInt = (value: string) => (value.trim() === '' ? NaN : Number(value.replaceAll(',', '')));

interface StepperProps {
    id: string;
    label: string;
    /** 숫자만 담은 문자열. 화면에는 천 단위 쉼표를 붙여 보여준다 */
    value: string;
    placeholder?: string;
    suffix: string;
    onChange: (value: string) => void;
    onStep: (direction: 1 | -1) => void;
}

/** 숫자 입력칸 양옆에 -/+ 버튼이 붙은 토스증권식 입력. */
function Stepper({ id, label, value, placeholder, suffix, onChange, onStep }: StepperProps) {
    const stepButton = (direction: 1 | -1, text: string) => (
        <button
            type="button"
            aria-label={`${label} ${direction > 0 ? '올리기' : '내리기'}`}
            onClick={() => onStep(direction)}
            className="size-10 shrink-0 rounded-lg bg-surface-2 text-lg text-muted hover:bg-surface-3"
        >
            {text}
        </button>
    );

    return (
        <div className="flex items-center gap-1.5">
            {stepButton(-1, '−')}
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-line px-3 focus-within:border-primary">
                <input
                    id={id}
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={value === '' ? '' : num(Number(value))}
                    onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
                    className="w-full min-w-0 bg-transparent text-right font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-faint"
                />
                <span className="ml-1 text-sm text-faint">{suffix}</span>
            </div>
            {stepButton(1, '+')}
        </div>
    );
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
    return (
        <div className={`flex justify-between ${strong ? 'text-[15px] font-bold' : 'text-sm'}`}>
            <dt className={strong ? '' : 'text-muted'}>{label}</dt>
            <dd className="tabular-nums">{children}</dd>
        </div>
    );
}

/** 종목이 바뀌면 입력을 비우도록 부모에서 key={stockId}로 렌더한다. */
export function OrderPanel({ stockId }: { stockId: string }) {
    const { account } = useGame();
    const ids = { qty: useId(), price: useId() };
    const stock = STOCK_BY_ID.get(stockId)!;
    const price = game.market.price(stockId);

    const [side, setSide] = useState<Side>('buy');
    const [kind, setKind] = useState<Kind>('limit');
    const [qtyText, setQtyText] = useState('');
    const [limitText, setLimitText] = useState(String(price));
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const unitPrice = kind === 'limit' ? toInt(limitText) : side === 'buy' ? askPrice(price) : bidPrice(price);
    const qty = toInt(qtyText);
    const maxQty =
        side === 'buy'
            ? unitPrice > 0
                ? maxBuyQty(availableCash(account), unitPrice)
                : 0
            : availableShares(account, stockId);
    const amount = qty > 0 && unitPrice > 0 ? qty * unitPrice : 0;
    const fee = feeFor(amount);

    const stepPrice = (direction: 1 | -1) => {
        const current = toInt(limitText) > 0 ? toInt(limitText) : price;
        // 아래로 내릴 때는 한 단계 아래 가격대의 호가 단위를 써야 경계에서 단위가 맞는다.
        const step = priceStep(direction > 0 ? current : current - 1);
        setLimitText(String(Math.max(1, Math.round(current / step) * step + direction * step)));
    };
    const stepQty = (direction: 1 | -1) =>
        setQtyText(String(Math.max(0, (toInt(qtyText) > 0 ? toInt(qtyText) : 0) + direction)));

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const result =
            kind === 'market'
                ? game.marketOrder(stockId, side, qty)
                : game.placeLimitOrder(stockId, side, qty, unitPrice);
        if (!result.ok) {
            setMessage({ ok: false, text: result.reason });
            return;
        }
        const verb = SIDE_STYLE[side].label;
        setMessage({
            ok: true,
            text: result.trade
                ? `${num(result.trade.qty)}주를 ${num(result.trade.price)}원에 ${verb}했어요`
                : `${num(qty)}주를 ${num(unitPrice)}원에 ${verb}하도록 주문을 걸어 뒀어요`,
        });
        setQtyText('');
    };

    return (
        <section aria-label="주문" className="rounded-2xl bg-surface p-5">
            <div role="tablist" aria-label="주문 종류" className="mb-4 grid grid-cols-2 border-b border-line">
                {(['buy', 'sell'] as const).map((s) => (
                    <button
                        key={s}
                        type="button"
                        role="tab"
                        aria-selected={side === s}
                        onClick={() => {
                            setSide(s);
                            setMessage(null);
                        }}
                        className={`-mb-px border-b-2 border-transparent pb-2.5 text-[17px] font-bold text-faint aria-selected:border-current ${SIDE_STYLE[s].tab}`}
                    >
                        {SIDE_STYLE[s].label}
                    </button>
                ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor={kind === 'limit' ? ids.price : undefined}
                            className="text-sm font-medium text-muted"
                        >
                            {SIDE_STYLE[side].label} 가격
                        </label>
                        <fieldset className="flex rounded-lg bg-surface-2 p-0.5 text-sm">
                            <legend className="sr-only">주문 방식</legend>
                            {(
                                [
                                    ['limit', '지정가'],
                                    ['market', '시장가'],
                                ] as const
                            ).map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    aria-pressed={kind === k}
                                    onClick={() => setKind(k)}
                                    className="rounded-md px-3 py-1 text-faint aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg aria-pressed:shadow-sm"
                                >
                                    {label}
                                </button>
                            ))}
                        </fieldset>
                    </div>
                    {kind === 'limit' ? (
                        <>
                            <Stepper
                                id={ids.price}
                                label="가격"
                                value={limitText}
                                suffix="원"
                                onChange={setLimitText}
                                onStep={stepPrice}
                            />
                            <p className="text-xs text-faint">
                                {side === 'buy'
                                    ? '구매가가 이 가격 이하로 내려오면 구매돼요'
                                    : '판매가가 이 가격 이상으로 올라오면 판매돼요'}
                            </p>
                        </>
                    ) : (
                        <p className="flex h-10 items-center justify-between rounded-lg bg-surface-2 px-3 text-sm">
                            <span className="text-faint">지금 바로 {SIDE_STYLE[side].label}</span>
                            <span className="font-semibold tabular-nums">{won(unitPrice)}</span>
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={ids.qty} className="text-sm font-medium text-muted">
                            수량
                        </label>
                        <span className="text-xs text-faint tabular-nums">
                            {side === 'buy' ? '최대' : '판매 가능'} {num(maxQty)}주
                        </span>
                    </div>
                    <Stepper
                        id={ids.qty}
                        label="수량"
                        value={qtyText}
                        placeholder="수량 입력"
                        suffix="주"
                        onChange={setQtyText}
                        onStep={stepQty}
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                        {RATIOS.map((ratio) => (
                            <button
                                key={ratio}
                                type="button"
                                onClick={() => setQtyText(String(Math.floor(maxQty * ratio)))}
                                className="rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-muted hover:bg-surface-3"
                            >
                                {ratio === 1 ? '최대' : `${ratio * 100}%`}
                            </button>
                        ))}
                    </div>
                </div>

                <dl className="space-y-1.5 border-t border-line pt-4">
                    <Row label="주문 금액">{won(amount)}</Row>
                    <Row label="수수료">{won(fee)}</Row>
                    <Row label={side === 'buy' ? '총 필요 금액' : '받을 금액'} strong>
                        {won(side === 'buy' ? amount + fee : amount - fee)}
                    </Row>
                    <p className="text-right text-xs text-faint tabular-nums">
                        주문 가능 {won(availableCash(account))}
                    </p>
                </dl>

                <button
                    type="submit"
                    className={`h-12 w-full rounded-xl text-[16px] font-bold text-white ${SIDE_STYLE[side].button}`}
                >
                    {stock.name} {SIDE_STYLE[side].label}하기
                </button>

                {message && (
                    <output
                        className={`block rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-primary/10 text-primary' : 'bg-warn/10 text-warn'}`}
                    >
                        {message.text}
                    </output>
                )}
            </form>
        </section>
    );
}
