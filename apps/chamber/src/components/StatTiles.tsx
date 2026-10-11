import { REGIMES } from '@gaemigul/queen';

import { percent, signedPercent } from '../format.ts';
import { REGIME_COLORS, REGIME_LABELS } from '../regimes.ts';
import type { SimulationStats } from '../stats.ts';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="mt-1 font-mono text-lg text-zinc-100 tabular-nums">{value}</div>
            {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
        </div>
    );
}

export function StatTiles({ stats }: { stats: SimulationStats }) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile label="전체 수익률" value={signedPercent(stats.totalReturn)} />
                <Tile
                    label="일간 변동성"
                    value={stats.dailyVol === null ? '—' : percent(stats.dailyVol)}
                    hint={stats.dailyVol === null ? '2일 이상부터 계산' : '목표 3~8%'}
                />
                <Tile label="평균 일중 고저폭" value={percent(stats.avgDailyRange)} />
                <Tile label="최대 낙폭" value={`-${percent(stats.maxDrawdown)}`} />
            </div>
            <div className="grid grid-cols-3 gap-3">
                {REGIMES.map((regime) => {
                    const hours = stats.regimeMeanHours[regime];
                    return (
                        <div key={regime} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: REGIME_COLORS[regime] }}
                                />
                                {REGIME_LABELS[regime]}
                            </div>
                            <div className="mt-1 font-mono text-lg text-zinc-100 tabular-nums">
                                {percent(stats.regimeShare[regime], 0)}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                                평균 {hours === null ? '—' : `${hours.toFixed(1)}시간`} 지속
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
