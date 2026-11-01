import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'docs/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // R3F JSX uses three.js props that the DOM-oriented rule does not know.
      'react/no-unknown-property': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
