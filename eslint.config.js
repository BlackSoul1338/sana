import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const MODULES = ['sprint', 'challenge-builder', 'match'];

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
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/drizzle/**', 'supabase/**'] },
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
    files: ['apps/api/src/core/**/*.ts', 'apps/api/src/platform/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/modules/**', '**/flows/**'], message: 'Ядро и platform не зависят от модулей.' }],
      }],
    },
  },
);
