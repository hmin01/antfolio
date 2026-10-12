/** @type {import('prettier').Config & import('@ianvs/prettier-plugin-sort-imports').PluginConfig & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
    tabWidth: 4,
    printWidth: 120,
    singleQuote: true,
    trailingComma: 'all',

    // prettier-plugin-tailwindcss는 다른 플러그인보다 뒤에 와야 한다.
    plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],

    // import 순서: React → 외부 패키지 → 워크스페이스 패키지(@antfolio) → 상대 경로
    importOrder: ['^react(-dom)?(/.*)?$', '<THIRD_PARTY_MODULES>', '', '^@antfolio/(.*)$', '', '^[.]'],
    importOrderTypeScriptVersion: '5.0.0',

    // Tailwind v4는 클래스 순서를 알기 위해 CSS 진입점이 필요하다. 두 앱 모두 기본 테마만 쓴다.
    tailwindStylesheet: './apps/web/src/index.css',

    overrides: [
        {
            // pnpm이 다시 쓰는 파일은 pnpm 기본값(2칸)에 맞춰 불필요한 변경을 막는다.
            files: ['package.json', '*.yaml', '*.yml'],
            options: { tabWidth: 2 },
        },
    ],
};
