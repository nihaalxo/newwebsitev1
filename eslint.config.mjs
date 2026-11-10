import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', '.build/**', '.wrangler/**', 'next-env.d.ts', 'public/**', 'worker/worker-configuration.d.ts'],
  },
  {
    rules: {
      // Uploads are resized in the browser and served as they are, so pages use plain <img> tags on purpose.
      '@next/next/no-img-element': 'off',
      // Hash links within the page and links to pages that must load fresh (the home page's intro) are plain <a>s.
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
];

export default config;
