// Flat ESLint config for the repo. Its primary job is to catch dead code —
// unused imports and variables — locally (via the pre-commit hook) before it
// ever reaches CI/CodeQL. It is intentionally lean, not a full style gate.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.nx/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // An unused import or binding is an error — this is exactly what leaked to CodeQL.
      // Names prefixed with `_` are treated as deliberately unused; unused catch bindings
      // are tolerated (swallowing an error is a legitimate pattern here).
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
];
