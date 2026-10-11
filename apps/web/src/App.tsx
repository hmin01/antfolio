import { AwaySummary } from './components/AwaySummary.tsx';
import { Header } from './components/Header.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { StockPage } from './pages/StockPage.tsx';
import { useRoute } from './router.ts';

export function App() {
    const route = useRoute();

    return (
        <div className="min-h-dvh">
            <Header />
            <main className="mx-auto max-w-[1200px] px-4 py-5">
                {route.page === 'stock' ? <StockPage stockId={route.stockId} /> : <HomePage />}
            </main>
            <AwaySummary />
        </div>
    );
}
