import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { Plugin } from 'vite';

import { versionSnippet } from '../src/versionSnippet.ts';

const MARKER = '    // @queen-versions-end';
const PARAM_KEYS = ['dailyVol', 'regimes', 'clustering', 'tailDf', 'jumps', 'reversionHalfLifeDays'];
const REGIME_KEYS = ['bull', 'bear', 'sideways'];

const leavesAreNumbers = (v: unknown): boolean =>
    typeof v === 'number'
        ? Number.isFinite(v)
        : typeof v === 'object' && v !== null && Object.values(v).every(leavesAreNumbers);

/** 모든 값이 유한한 숫자인 엔진 설정 모양인지 확인한다. */
function isEngineParams(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || !leavesAreNumbers(value)) return false;
    const params = value as Record<string, unknown>;
    const regimes = params.regimes as Record<string, unknown> | undefined;
    return PARAM_KEYS.every((k) => k in params) && REGIME_KEYS.every((k) => regimes && k in regimes);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    let body = '';
    for await (const chunk of req) body += chunk;
    return JSON.parse(body);
}

/**
 * 개발 서버 전용. 여왕의 방에서 보낸 설정을 queen의 PARAM_VERSIONS 맨 뒤에 새 버전으로 추가한다.
 * 파일이 바뀌면 열려 있는 게임이 새로고침되고, 게임은 새 버전을 발견한 때부터 1분 뒤에 적용한다.
 */
export function applyVersionPlugin(): Plugin {
    let paramsFile = '';

    return {
        name: 'gaemigul:apply-version',
        apply: 'serve',
        configResolved(config) {
            paramsFile = resolve(config.root, '../../packages/queen/src/params.ts');
        },
        configureServer(server) {
            server.middlewares.use('/__queen/apply', (req, res) => {
                const reply = (status: number, body: object) => {
                    res.statusCode = status;
                    res.setHeader('content-type', 'application/json');
                    res.end(JSON.stringify(body));
                };
                if (req.method !== 'POST') return reply(405, { error: 'POST만 받아요' });

                void (async () => {
                    try {
                        const { params } = (await readJson(req)) as { params?: unknown };
                        if (!isEngineParams(params)) return reply(400, { error: '엔진 설정 모양이 아니에요' });

                        const source = await readFile(paramsFile, 'utf8');
                        if (!source.includes(MARKER))
                            return reply(500, { error: 'params.ts에서 추가 위치를 찾지 못했어요' });

                        const ids = [...source.matchAll(/id: 'v(\d+)'/g)].map((m) => Number(m[1]));
                        const id = `v${Math.max(0, ...ids) + 1}`;
                        const next = source.replace(MARKER, versionSnippet(id, params as never) + MARKER);
                        const options = await resolveConfig(paramsFile);
                        await writeFile(paramsFile, await format(next, { ...options, filepath: paramsFile }));
                        reply(200, { id });
                    } catch (error) {
                        reply(500, { error: String(error) });
                    }
                })();
            });
        },
    };
}
