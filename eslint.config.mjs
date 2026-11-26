import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { readabilityPlugins, readabilityRules } from './scripts/readability.mjs';

export default [
  {
    ignores: [
      'node_modules/**',
      'package/**',
      'coverage/**',
      'artifacts/**',
      '**/temp/**',
      '**/.tmp/**',
      'nbproject/**',
      '.build-*/**',
      '**/*.min.js',
      '**/*.map'
    ]
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,cjs,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }]
    }
  },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
  // The portable global resolver also supports browser workers.
  { files: ['src/util/getGlobal.js'], languageOptions: { globals: { self: 'readonly', window: 'readonly' } } },
  { files: ['test/browser/**/*.js'], languageOptions: { sourceType: 'script', globals: globals.browser } },
  // The runtime adapter supplies only these two node:test aliases.
  { files: ['test/**/*.js'], languageOptions: { globals: { suite: 'readonly', test: 'readonly' } } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,cts,mts,tsx}'] })),
  // Public declarations and compiler fixtures retain their intentional API types and import-equals forms.
  {
    files: ['**/*.d.{ts,cts,mts}', 'test/**/*.{ts,cts,mts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }]
    }
  },
  // Compiler fixtures assert type acceptance/rejection without necessarily reading each binding at runtime.
  {
    files: ['test/**/*.{ts,cts,mts,tsx}', 'types/**/*.d.{ts,cts,mts}', '**/*.d.{ts,cts,mts}'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-empty-object-type': 'off' }
  },
  // Boxed-value contracts, explicit receiver checks and ambient/browser fixtures are intentional.
  {
    ignores: [
      'docs/html/**',
      'benchmarks/baseline-*/**',
      'benchmarks/adapters/results/**',
      'benchmarks/results/**',
      'experimental/**'
    ]
  },
  {
    files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'IfStatement > ReturnStatement', message: 'Wrap conditional returns in braces.' }
      ]
    }
  },
  // The shared checker is synchronised from its canonical owner.
  { files: ['scripts/lib/check-library-readme.cjs'], rules: { 'no-restricted-syntax': 'off' } },
  { files: ['test/browser/contracts.js'], languageOptions: { globals: { goFnsTestClock: 'readonly' } } },
  {
    name: 'go-fns/readability',
    files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
    plugins: readabilityPlugins,
    rules: readabilityRules
  },
  // This byte-identical canonical checker has an external owner; retain its correctness checks.
  {
    files: ['scripts/lib/check-library-readme.cjs'],
    rules: {
      'jsdoc/lines-before-block': 'off',
      '@stylistic/padding-line-between-statements': 'off'
    }
  }
];
