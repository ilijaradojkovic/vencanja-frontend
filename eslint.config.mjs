import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The Next.js app lives in a workspace, so the plugin needs its root.
    settings: { next: { rootDir: 'apps/web/' } },
  },
  {
    // The frozen demo is a Vite prototype kept as a reference. It is linted for
    // plain JavaScript/React mistakes, but Next.js-only advice and rules that
    // would force a refactor of frozen code are switched off.
    files: ['apps/demo/**/*.{js,jsx}'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly' },
    },
    rules: {
      '@next/next/no-img-element': 'off',
      'import/no-anonymous-default-export': 'off',
      'jsx-a11y/role-supports-aria-props': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  prettier,
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    'package-lock.json',
  ]),
]);
