import { compressTime, PARAM_VERSIONS, type EngineParams } from '@gaemigul/queen';

import { roundParams } from './versionSnippet.ts';

export interface Preset {
    id: string;
    label: string;
    summary: string;
    params: EngineParams;
}

/** 기준 설정 v1(게임 1시간 = 실제 하루). 버전은 고치지 않으므로 프리셋도 늘 같은 값이다. */
const BASE = PARAM_VERSIONS[0]!.params;

/**
 * 기준 설정에서 시간만 압축한 속도 단계. 게임에 적용할 때와 같은 자릿수로 반올림해 둔다.
 * 차트 모양은 같고, 같은 흐름이 2배·4배 빨리 지나간다.
 */
export const PRESETS: Preset[] = [
    { id: 'x1', label: '1배속', summary: '게임 1시간 = 실제 하루', params: roundParams(compressTime(BASE, 1)) },
    { id: 'x2', label: '2배속', summary: '게임 1시간 = 실제 이틀', params: roundParams(compressTime(BASE, 2)) },
    { id: 'x4', label: '4배속', summary: '게임 1시간 = 실제 나흘', params: roundParams(compressTime(BASE, 4)) },
];
