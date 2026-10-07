import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    }
  },
  {
    files: ['packages/core/src/reasoning/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { enforceConst: true, ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true }
      ]
    }
  }
);
