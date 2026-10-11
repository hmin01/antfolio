import type { Account } from './account.ts';
import type { MarketSnapshot, ParamSchedule } from './market.ts';

// 틱 간격이 15초에서 10초로 바뀌면서 예전 저장의 가격 기록은 이어갈 수 없어 새 키를 쓴다.
const KEY = 'gaemigul:save:v2';
const OLD_KEYS = ['gaemigul:save:v1'];

export interface SaveData {
    version: 2;
    worldSeed: number;
    /** 시장이 시작된 시각. 처음 접속 3일 전 자정으로 잡아 시작부터 차트에 과거가 있게 한다 */
    epoch: number;
    /** 엔진 설정 버전을 언제부터 적용하는지. 지나간 가격을 다시 계산할 때도 이 일정을 따른다 */
    paramSchedule: ParamSchedule;
    /** 가격 기록의 첫 틱과 그때의 엔진 상태. 없으면 시장 시작 틱부터 계산한다 */
    marketSnapshot?: MarketSnapshot | null;
    account: Account;
    /** 지정가 주문 체결까지 처리한 마지막 틱 */
    processedTick: number;
    /** 화면을 마지막으로 본 틱과 그때의 총자산. 자리 비운 동안 요약에 쓴다 */
    lastSeenTick: number;
    lastSeenValue: number;
}

export function loadSave(): SaveData | null {
    try {
        for (const key of OLD_KEYS) localStorage.removeItem(key);
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
        // 저장 공간이 없거나 막혀 있어도 게임은 계속 진행한다.
    }
}
