import { useState } from 'react';

import { AccountTabs } from './components/AccountTabs.tsx';
import { AwaySummary } from './components/AwaySummary.tsx';
import { Header } from './components/Header.tsx';
import { OrderPanel } from './components/OrderPanel.tsx';
import { StockChart } from './components/StockChart.tsx';
import { StockList } from './components/StockList.tsx';
import { STOCKS } from './game/stocks.ts';

export function App() {
    const [stockId, setStockId] = useState(STOCKS[0]!.id);

    // 모바일에서는 종목 → 차트 → 주문 → 계좌 순서로 쌓고, 넓은 화면에서는 3단으로 배치한다.
    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100">
            <Header />
            <main className="mx-auto grid max-w-[1400px] gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr]">
                <aside className="lg:sticky lg:top-20 lg:row-span-2 lg:self-start">
                    <StockList selectedId={stockId} onSelect={setStockId} />
                </aside>
                <div className="min-w-0 lg:col-start-2">
                    <StockChart stockId={stockId} />
                </div>
                <aside className="lg:sticky lg:top-20 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-start">
                    <OrderPanel key={stockId} stockId={stockId} />
                </aside>
                <div className="min-w-0 lg:col-start-2 lg:row-start-2">
                    <AccountTabs onSelect={setStockId} />
                </div>
            </main>
            <AwaySummary />
        </div>
    );
}
