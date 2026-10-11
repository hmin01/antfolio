import { useDeferredValue, useMemo, useState } from 'react';

import { DEFAULT_PARAMS, REGIMES, simulate, TICK_MS, TICKS_PER_DAY, toCandles } from '@gaemigul/queen';

import { ParamPanel } from './components/ParamPanel.tsx';
import { PriceChart, type RegimeBand } from './components/PriceChart.tsx';
import { StatTiles } from './components/StatTiles.tsx';
import { REGIME_COLORS, REGIME_LABELS } from './regimes.ts';
import { computeStats } from './stats.ts';

/** 시뮬레이션 시작 시각. 로컬 자정에 맞춰야 일봉 경계가 하루와 일치한다. */
const EPOCH = new Date(2026, 0, 1).getTime();

const TIMEFRAMES = [
    { id: '15s', label: '15초', ticks: 1 },
    { id: '1m', label: '1분', ticks: 4 },
    { id: '5m', label: '5분', ticks: 20 },
    { id: '1h', label: '1시간', ticks: 240 },
    { id: '1d', label: '1일', ticks: TICKS_PER_DAY },
] as const;
type TimeframeId = (typeof TIMEFRAMES)[number]['id'];

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export function App() {
    const [seed, setSeed] = useState(42);
    const [days, setDays] = useState(7);
    const [initialPrice, setInitialPrice] = useState(10_000);
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [timeframeId, setTimeframeId] = useState<TimeframeId>('5m');

    // 슬라이더를 끄는 동안 입력이 막히지 않도록 무거운 재계산은 뒤로 미룬다.
    // 매 렌더마다 새로 생기는 객체를 넘기면 끝없이 다시 렌더링되므로 값마다 따로 미룬다.
    const deferredSeed = useDeferredValue(seed);
    const deferredDays = useDeferredValue(days);
    const deferredInitialPrice = useDeferredValue(initialPrice);
    const deferredParams = useDeferredValue(params);
    const timeframe = TIMEFRAMES.find((t) => t.id === timeframeId)!;

    const result = useMemo(
        () =>
            simulate({
                seed: deferredSeed,
                params: deferredParams,
                initialPrice: deferredInitialPrice,
                ticks: deferredDays * TICKS_PER_DAY,
            }),
        [deferredSeed, deferredDays, deferredInitialPrice, deferredParams],
    );
    const stats = useMemo(() => computeStats(result), [result]);
    const candles = useMemo(() => toCandles(result.prices, timeframe.ticks, EPOCH), [result, timeframe]);
    const regimeBands = useMemo<RegimeBand[]>(
        () =>
            candles.map((c, i) => {
                const lastTick = Math.min((i + 1) * timeframe.ticks, result.regimes.length - 1);
                return { time: c.time, color: REGIME_COLORS[REGIMES[result.regimes[lastTick]!]!] };
            }),
        [candles, result, timeframe],
    );

    return (
        <div className="min-h-dvh bg-zinc-950 text-zinc-100 lg:grid lg:h-dvh lg:grid-cols-[320px_1fr]">
            <aside className="border-zinc-800 p-5 lg:overflow-y-auto lg:border-r">
                <ParamPanel params={params} onChange={setParams} />
            </aside>

            <main className="min-w-0 space-y-4 p-5 lg:overflow-y-auto">
                <header>
                    <h1 className="text-2xl font-bold">여왕의 방</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        개미굴 가격 엔진 시뮬레이터 · {TICK_MS / 1000}초 틱{' '}
                        {(days * TICKS_PER_DAY).toLocaleString('ko-KR')}개
                    </p>
                </header>

                <div className="flex flex-wrap items-end gap-4 text-sm">
                    <label className="space-y-1">
                        <span className="block text-zinc-400">시드</span>
                        <span className="flex gap-1">
                            <input
                                type="number"
                                value={seed}
                                onChange={(e) => setSeed(Number(e.target.value) || 0)}
                                className="w-32 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setSeed(randomSeed())}
                                className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
                            >
                                다시 뽑기
                            </button>
                        </span>
                    </label>
                    <label className="space-y-1">
                        <span className="block text-zinc-400">기간 {days}일</span>
                        <input
                            type="range"
                            min={1}
                            max={30}
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="w-40 accent-zinc-300"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="block text-zinc-400">시작 가격</span>
                        <input
                            type="number"
                            min={1}
                            value={initialPrice}
                            onChange={(e) => setInitialPrice(Math.max(1, Number(e.target.value) || 1))}
                            className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono"
                        />
                    </label>
                    <fieldset className="flex rounded-md border border-zinc-700 p-0.5">
                        <legend className="sr-only">캔들 단위</legend>
                        {TIMEFRAMES.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                aria-pressed={t.id === timeframeId}
                                onClick={() => setTimeframeId(t.id)}
                                className={`rounded px-2.5 py-1 ${t.id === timeframeId ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </fieldset>
                </div>

                <PriceChart candles={candles} regimeBands={regimeBands} fitKey={`${timeframeId}-${days}`} />

                <div className="flex gap-4 text-xs text-zinc-400">
                    <span>하단 띠:</span>
                    {REGIMES.map((regime) => (
                        <span key={regime} className="flex items-center gap-1.5">
                            <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: REGIME_COLORS[regime] }} />
                            {REGIME_LABELS[regime]}
                        </span>
                    ))}
                </div>

                <StatTiles stats={stats} />
            </main>
        </div>
    );
}
