import type { EngineParams } from '@gaemigul/queen';

/** 코드에 남길 값이라 유효숫자 6자리로 줄인다. 시뮬레이션 결과에는 차이가 없다. */
const roundNumbers = (_key: string, value: unknown) =>
    typeof value === 'number' ? Number(value.toPrecision(6)) : value;

export function roundParams(params: EngineParams): EngineParams {
    return JSON.parse(JSON.stringify(params, roundNumbers)) as EngineParams;
}

/** params.ts의 PARAM_VERSIONS 맨 뒤에 그대로 붙여 넣을 수 있는 코드 */
export function versionSnippet(id: string, params: EngineParams): string {
    const body = JSON.stringify(params, roundNumbers, 4)
        .replace(/"(\w+)":/g, '$1:')
        .replace(/\n/g, '\n        ');
    return `    {\n        id: '${id}',\n        params: ${body},\n    },\n`;
}
