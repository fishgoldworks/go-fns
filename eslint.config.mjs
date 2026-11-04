import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      'package/**',
      'dist/**',
      'esm/**',
      'es/**',
      'coverage/**',
      'artifacts/**',
      'vendor/**',
      '**/temp/**',
      '**/.tmp/**',
      'nbproject/**',
      '.build-*/**',
      '.package-*/**',
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
  { files: ['test/browser/contracts.js'], languageOptions: { globals: { goFnsTestClock: 'readonly' } } }
];
