import type { StockDef } from '../game/stocks.ts';

interface StockAvatarProps {
    stock: StockDef;
    size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-11 text-base' } as const;

/** 로고 대신 종목 이름 첫 글자를 담은 색 원 */
export function StockAvatar({ stock, size = 'md' }: StockAvatarProps) {
    return (
        <span
            aria-hidden
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZE_CLASS[size]}`}
            style={{ backgroundColor: stock.color }}
        >
            {stock.name[0]}
        </span>
    );
}
