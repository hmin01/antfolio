import type { ReactNode } from 'react';

interface PanelProps {
    title?: ReactNode;
    /** 제목 오른쪽의 보조 정보나 버튼 */
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** 바탕 위에 떠 있는 토스증권식 흰 카드 */
export function Panel({ title, action, className = '', children }: PanelProps) {
    return (
        <section className={`rounded-2xl bg-surface p-5 ${className}`}>
            {(title || action) && (
                <div className="mb-3 flex items-center justify-between gap-3">
                    {title && <h2 className="text-[17px] font-bold">{title}</h2>}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}
