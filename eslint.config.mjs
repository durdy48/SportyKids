import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/prisma/migrations/**',
      'apps/api/prisma/seed.ts',
      'apps/api/prisma/backfill-safety.ts',
      'specs/**',
    ],
  },

  // Base TypeScript rules for all workspaces
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // Disable no-undef for TypeScript files — TypeScript handles this
      'no-undef': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow non-null assertions — common pattern in this codebase
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow namespace for Express augmentation
      '@typescript-eslint/no-namespace': 'off',
      // Allow require() for dynamic imports
      '@typescript-eslint/no-require-imports': 'off',
      // Relax rules too strict for existing codebase
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      'no-control-regex': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-assignment': 'off',
    },
  },

  // Web-specific (Next.js / React / browser)
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooksPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Mobile-specific (React Native / Expo)
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooksPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Test files — relaxed rules
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },

  // Prettier must be last
  prettierConfig,
];
