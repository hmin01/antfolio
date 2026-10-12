import { AssetSummary } from '../components/AssetSummary.tsx';
import { MyStocks } from '../components/MyStocks.tsx';
import { StockTable } from '../components/StockTable.tsx';

/** 전체 종목과 내 주식을 한 화면에 배치. 넓은 화면에서는 내 자산을 오른쪽에 고정 */
export function HomePage() {
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-start-1 lg:self-start">
                <AssetSummary />
                <MyStocks />
            </div>
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <StockTable />
            </div>
        </div>
    );
}
