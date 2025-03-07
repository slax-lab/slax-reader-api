import tseslint from 'typescript-eslint'
import prettierRecommend from 'eslint-plugin-prettier/recommended'
import typescriptParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'

export default [
  {
    ignores: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.wrangler/**', '**/test/**', 'vitest.config.ts']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  prettierRecommend,
  prettierConfig
]
