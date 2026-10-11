import { useState, type ReactNode } from 'react';

import {
    LATEST_VERSION,
    PARAM_VERSIONS,
    REGIMES,
    type EngineParams,
    type Regime,
    type RegimeParams,
} from '@gaemigul/queen';

import { percent, signedPercent } from '../format.ts';
import { REGIME_COLORS, REGIME_LABELS } from '../regimes.ts';
import { Slider } from './Slider.tsx';

interface ParamPanelProps {
    params: EngineParams;
    onChange: (params: EngineParams) => void;
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
    return (
        <section className="space-y-3 border-t border-zinc-800 pt-4">
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            {children}
        </section>
    );
}

/** params.ts의 PARAM_VERSIONS 맨 뒤에 그대로 붙여 넣을 수 있는 코드 */
function versionSnippet(id: string, params: EngineParams): string {
    const body = JSON.stringify(params, null, 4)
        .replace(/"(\w+)":/g, '$1:')
        .replace(/\n/g, '\n        ');
    return `    {\n        id: '${id}',\n        params: ${body},\n    },\n`;
}

export function ParamPanel({ params, onChange }: ParamPanelProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const changed = JSON.stringify(params) !== JSON.stringify(LATEST_VERSION.params);
    const nextId = `v${PARAM_VERSIONS.length + 1}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(versionSnippet(nextId, params));
            setCopied(
                `${nextId}로 복사했어요. packages/queen/src/params.ts의 PARAM_VERSIONS 맨 뒤에 붙여 넣으면, 게임이 다음에 열릴 때 1분 뒤부터 적용돼요.`,
            );
        } catch {
            setCopied('클립보드에 복사하지 못했어요. 브라우저 권한을 확인해 주세요.');
        }
    };

    const set = (patch: Partial<EngineParams>) => onChange({ ...params, ...patch });
    const setRegime = (regime: Regime, patch: Partial<RegimeParams>) =>
        set({ regimes: { ...params.regimes, [regime]: { ...params.regimes[regime], ...patch } } });

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">엔진 파라미터</h2>
                    <button
                        type="button"
                        onClick={() => onChange(LATEST_VERSION.params)}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                        게임 설정으로
                    </button>
                </div>
                <p className="text-xs text-zinc-500">
                    지금 게임 설정: {LATEST_VERSION.id}
                    {changed && <span className="text-amber-400"> · 바꾼 값이 있어요</span>}
                </p>
                <button
                    type="button"
                    onClick={copy}
                    disabled={!changed}
                    className="w-full rounded-md bg-zinc-100 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                    {nextId}로 설정 복사
                </button>
                {copied && <output className="block text-xs text-emerald-400">{copied}</output>}
            </div>

            <Section title="기본">
                <Slider
                    label="일간 변동성"
                    hint="국면·점프를 빼고 평소 하루에 움직이는 정도"
                    value={params.dailyVol}
                    min={0.005}
                    max={0.15}
                    step={0.005}
                    format={(v) => percent(v)}
                    onChange={(dailyVol) => set({ dailyVol })}
                />
                <Slider
                    label="평균회귀 반감기"
                    hint="적정가치에서 벌어진 거리가 절반으로 줄어드는 기간. 길수록 추세가 오래 감"
                    value={params.reversionHalfLifeDays}
                    min={1}
                    max={60}
                    step={1}
                    format={(v) => `${v}일`}
                    onChange={(reversionHalfLifeDays) => set({ reversionHalfLifeDays })}
                />
            </Section>

            {REGIMES.map((regime) => (
                <Section
                    key={regime}
                    title={
                        <span className="flex items-center gap-2">
                            <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: REGIME_COLORS[regime] }}
                            />
                            {REGIME_LABELS[regime]}
                        </span>
                    }
                >
                    <Slider
                        label="하루 추세"
                        value={params.regimes[regime].driftPerDay}
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        format={(v) => signedPercent(v, 0)}
                        onChange={(driftPerDay) => setRegime(regime, { driftPerDay })}
                    />
                    <Slider
                        label="변동성 배율"
                        value={params.regimes[regime].volScale}
                        min={0.3}
                        max={3}
                        step={0.05}
                        format={(v) => `×${v.toFixed(2)}`}
                        onChange={(volScale) => setRegime(regime, { volScale })}
                    />
                    <Slider
                        label="평균 지속 시간"
                        value={params.regimes[regime].meanHours}
                        min={0.5}
                        max={48}
                        step={0.5}
                        format={(v) => `${v}시간`}
                        onChange={(meanHours) => setRegime(regime, { meanHours })}
                    />
                </Section>
            ))}

            <Section title="변동성 뭉침">
                <Slider
                    label="충격 반영 (α)"
                    hint="큰 움직임 직후 변동성이 얼마나 튀어 오르는지"
                    value={params.clustering.alpha}
                    min={0}
                    max={0.2}
                    step={0.005}
                    format={(v) => v.toFixed(3)}
                    onChange={(alpha) => set({ clustering: { ...params.clustering, alpha } })}
                />
                <Slider
                    label="지속성 (β)"
                    hint="높아진 변동성이 얼마나 오래 이어지는지. α + β는 0.999에서 잘림"
                    value={params.clustering.beta}
                    min={0.5}
                    max={0.999}
                    step={0.001}
                    format={(v) => v.toFixed(3)}
                    onChange={(beta) => set({ clustering: { ...params.clustering, beta } })}
                />
            </Section>

            <Section title="두꺼운 꼬리">
                <Slider
                    label="자유도"
                    hint="작을수록 평소보다 큰 움직임이 자주 나옴. 30이면 정규분포에 가까움"
                    value={params.tailDf}
                    min={3}
                    max={30}
                    step={1}
                    format={(v) => String(v)}
                    onChange={(tailDf) => set({ tailDf })}
                />
            </Section>

            <Section title="급등락 (점프)">
                <Slider
                    label="하루 평균 횟수"
                    value={params.jumps.perDay}
                    min={0}
                    max={10}
                    step={0.1}
                    format={(v) => `${v.toFixed(1)}회`}
                    onChange={(perDay) => set({ jumps: { ...params.jumps, perDay } })}
                />
                <Slider
                    label="한 번의 크기"
                    value={params.jumps.size}
                    min={0}
                    max={0.2}
                    step={0.005}
                    format={(v) => `±${percent(v)}`}
                    onChange={(size) => set({ jumps: { ...params.jumps, size } })}
                />
            </Section>
        </div>
    );
}
