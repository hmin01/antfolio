/** @type {import('prettier').Config & import('@ianvs/prettier-plugin-sort-imports').PluginConfig & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
    tabWidth: 4,
    printWidth: 120,
    singleQuote: true,
    trailingComma: 'all',

    // prettier-plugin-tailwindcss는 다른 플러그인보다 뒤에 위치 필수
    plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],

    // import 순서: React → 외부 패키지 → 워크스페이스 패키지(@antfolio) → 상대 경로
    importOrder: ['^react(-dom)?(/.*)?$', '<THIRD_PARTY_MODULES>', '', '^@antfolio/(.*)$', '', '^[.]'],
    importOrderTypeScriptVersion: '5.0.0',

    // Tailwind v4 클래스 정렬용 CSS 진입점(기본 테마만 사용)
    tailwindStylesheet: './apps/web/src/index.css',

    overrides: [
        {
            // pnpm이 다시 쓰는 파일은 pnpm 기본값(2칸)에 맞춰 불필요한 변경 방지
            files: ['package.json', '*.yaml', '*.yml'],
            options: { tabWidth: 2 },
        },
    ],
};
