import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Playwright writes its report and per-run artefacts into the tree.
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // NOTE: this pattern exempts every capitalized identifier, so an unused
      // React component import is invisible to the linter (a dead `X` import
      // survived this way). Fixing it properly means adding
      // eslint-plugin-react and enabling `react/jsx-uses-vars`, because
      // narrowing the pattern alone flags every JSX-referenced component as
      // unused. Tracked as a follow-up.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
