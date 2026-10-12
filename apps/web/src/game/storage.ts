import type { Account } from './account.ts';
import type { DividendPolicy } from './dividends.ts';
import type { EngineDays, ParamSchedule } from './market.ts';

// 틱 간격 15초 → 10초 변경으로 예전 가격 기록과 호환되지 않아 새 키 사용
const KEY = 'antfolio:save:v2';
const OLD_KEYS = ['gaemigul:save:v1'];
// 개미굴(gaemigul) 시절 키. 새 키로 저장 이전
const RENAMED_KEY = 'gaemigul:save:v2';

export interface SaveData {
    version: 2;
    worldSeed: number;
    /** 시장 시작 시각. 첫 접속 3일 전 자정으로 잡아 처음부터 차트에 과거 표시 */
    epoch: number;
    /** 엔진 설정 버전별 적용 시작 틱. 지난 가격 재계산에도 사용 */
    paramSchedule: ParamSchedule;
    /** 종목별 하루 경계 엔진 상태. 다음 실행 시 계산 시작점, 없으면 시장 시작 틱부터 */
    engineDays?: EngineDays;
    /** 종목별 배당 공시 기록. 없으면 오늘 자정에 기본 주당 배당금으로 시작 */
    dividendPolicy?: DividendPolicy;
    account: Account;
    /** 지정가 주문 체결까지 처리한 마지막 틱 */
    processedTick: number;
    /** 마지막으로 화면을 본 틱과 그때의 총자산(자리 비움 요약용) */
    lastSeenTick: number;
    lastSeenValue: number;
}

export function loadSave(): SaveData | null {
    try {
        for (const key of OLD_KEYS) localStorage.removeItem(key);
        const renamed = localStorage.getItem(RENAMED_KEY);
        if (renamed) {
            if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, renamed);
            localStorage.removeItem(RENAMED_KEY);
        }
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as SaveData;
        return data.version === 2 ? data : null;
    } catch {
        return null;
    }
}

export function writeSave(data: SaveData): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
        // 저장 실패(공간 부족·차단) 시에도 게임 진행
    }
}
