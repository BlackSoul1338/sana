import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MODULES = ['sprint', 'challenge-builder', 'match', 'practice', 'research'];

// Модули не импортируют друг друга и flows; ядро не импортирует модули и flows.
const moduleBoundaries = MODULES.map((name) => ({
  files: [`apps/api/src/modules/${name}/**/*.ts`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        ...MODULES.filter((m) => m !== name).map((m) => ({
          group: [`**/${m}/**`, `**/${m}`],
          message: 'Модули не импортируют друг друга: используйте core, события или flows/.',
        })),
        { group: ['**/flows/**'], message: 'flows стоят над модулями.' },
      ],
    }],
  },
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/drizzle/**', 'supabase/**', '**/.cloudflare/**', '**/.wrangler/**', 'apps/web/src/app/routeTree.gen.ts', 'apps/web/src/shared/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Ответы HTTP в тестах проверяются через toMatchObject — типизация тела там избыточна.
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  ...moduleBoundaries,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // shadcn/ui components export variants next to components; route files export Route objects.
    files: ['apps/web/src/shared/ui/**', 'apps/web/src/app/routes/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['apps/api/src/core/**/*.ts', 'apps/api/src/platform/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/modules/**', '**/flows/**'], message: 'Ядро и platform не зависят от модулей.' }],
      }],
    },
  },
);
