// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.neutral.json', 'tsconfig.test.json', 'tsconfig.build.json'],
        tsconfigRootDir: import.meta.dirname,
        
      },
    }
  },
  {
    ignores: [ 'eslint.config.js', '**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**', '**/ReadonlyUint8Array.ts']
  },
  {
    rules: {
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
      }],
    }
  }
);
