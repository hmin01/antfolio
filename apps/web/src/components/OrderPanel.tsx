import { useId, useState, type FormEvent } from 'react';
import {
  askPrice,
  availableCash,
  availableShares,
  bidPrice,
  feeFor,
  maxBuyQty,
  type Side,
} from '../game/account.ts';
import { STOCK_BY_ID } from '../game/stocks.ts';
import { game, useGame } from '../game/store.ts';
import { num, won } from '../format.ts';

type Kind = 'market' | 'limit';

const SIDE_STYLE: Record<Side, { label: string; active: string; button: string }> = {
  buy: { label: '매수', active: 'bg-red-500/15 text-red-300', button: 'bg-red-500 hover:bg-red-400' },
  sell: { label: '매도', active: 'bg-blue-500/15 text-blue-300', button: 'bg-blue-500 hover:bg-blue-400' },
};

const toInt = (value: string) => (value.trim() === '' ? NaN : Number(value.replaceAll(',', '')));

/** 종목이 바뀌면 입력을 비우도록 부모에서 key={stockId}로 렌더한다. */
export function OrderPanel({ stockId }: { stockId: string }) {
  const { account } = useGame();
  const ids = { qty: useId(), price: useId() };
  const stock = STOCK_BY_ID.get(stockId)!;
  const price = game.market.price(stockId);

  const [side, setSide] = useState<Side>('buy');
  const [kind, setKind] = useState<Kind>('market');
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
        ? `${stock.name} ${num(result.trade.qty)}주를 ${num(result.trade.price)}원에 ${verb}했어요`
        : `${stock.name} ${num(qty)}주 ${num(unitPrice)}원 ${verb} 주문을 걸어 뒀어요`,
    });
    setQtyText('');
  };

  return (
    <section aria-label="주문" className="space-y-4 rounded-lg border border-zinc-800 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-900 p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => {
              setSide(s);
              setMessage(null);
            }}
            className={`rounded py-1.5 text-sm font-semibold ${side === s ? SIDE_STYLE[s].active : 'text-zinc-400'}`}
          >
            {SIDE_STYLE[s].label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">주문 방식</legend>
          {(
            [
              ['market', '시장가'],
              ['limit', '지정가'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="accent-zinc-300" />
              {label}
            </label>
          ))}
        </fieldset>

        {kind === 'market' ? (
          <p className="text-sm text-zinc-400">
            지금 {SIDE_STYLE[side].label}가 <span className="font-mono text-zinc-100">{won(unitPrice)}</span>
          </p>
        ) : (
          <div className="space-y-1">
            <label htmlFor={ids.price} className="text-sm text-zinc-400">
              가격
            </label>
            <input
              id={ids.price}
              inputMode="numeric"
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-right font-mono"
            />
            <p className="text-xs text-zinc-500">
              {side === 'buy' ? '매수가가 이 가격 이하로 내려오면' : '매도가가 이 가격 이상으로 올라오면'} 체결돼요
            </p>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor={ids.qty} className="text-zinc-400">
              수량
            </label>
            <span className="text-xs text-zinc-500">
              {side === 'buy' ? '최대' : '매도 가능'} {num(maxQty)}주
            </span>
          </div>
          <input
            id={ids.qty}
            inputMode="numeric"
            placeholder="0"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-right font-mono"
          />
          <div className="grid grid-cols-4 gap-1">
            {[0.1, 0.25, 0.5, 1].map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setQtyText(String(Math.floor(maxQty * ratio)))}
                className="rounded border border-zinc-800 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
              >
                {ratio === 1 ? '최대' : `${ratio * 100}%`}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-1 border-t border-zinc-800 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-400">주문 금액</dt>
            <dd className="font-mono">{won(amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">수수료</dt>
            <dd className="font-mono">{won(fee)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{side === 'buy' ? '총 필요 금액' : '받을 금액'}</dt>
            <dd className="font-mono">{won(side === 'buy' ? amount + fee : amount - fee)}</dd>
          </div>
        </dl>

        <button type="submit" className={`w-full rounded-md py-2.5 font-semibold text-white ${SIDE_STYLE[side].button}`}>
          {stock.name} {SIDE_STYLE[side].label}
        </button>

        {message && (
          <output className={`block text-sm ${message.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{message.text}</output>
        )}
      </form>
    </section>
  );
}
