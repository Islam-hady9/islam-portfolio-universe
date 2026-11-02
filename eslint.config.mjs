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
    // WebGL layer: mutating three.js objects (uniforms, matrices, camera) inside useFrame is the
    // idiomatic React Three Fiber pattern. These React-Compiler-oriented rules assume hook
    // results are immutable; the compiler is not used here. Scoped to src/experience only.
    files: ['src/experience/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'off',
    },
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
