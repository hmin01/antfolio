import { useId } from 'react';

interface SliderProps {
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
    onChange: (value: number) => void;
}

export function Slider({ label, hint, value, min, max, step, format, onChange }: SliderProps) {
    const id = useId();

    return (
        <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
                <label htmlFor={id} className="text-zinc-300">
                    {label}
                </label>
                <output htmlFor={id} className="font-mono text-zinc-100 tabular-nums">
                    {format(value)}
                </output>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-zinc-300"
            />
            {hint && <p className="text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}
