import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['**/routeTree.gen.ts', '**/shared/api/schema.d.ts'] },
  // Slices are split by user action on purpose; many are used by a single page today.
  { rules: { 'fsd/insignificant-slice': 'off' } },
]);
