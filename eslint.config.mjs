import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    // '.next/**' only matched a top-level build folder, not one nested
    // inside a worktree (.claude/worktrees/<agent>/.next/**) — found live
    // when a parallel background agent's leftover worktree, still present
    // after its branch was merged and the worktree removed, made `npm run
    // lint` report 38,000+ problems, all of them generated build output,
    // not real findings. '**/.next/**' matches at any depth; the whole
    // worktrees directory is excluded too, since nothing in it is this
    // repo's own source regardless of what's inside.
    ignores: ['**/.next/**', 'node_modules/**', 'next-env.d.ts', 'supabase/**', '.claude/worktrees/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
];

export default config;
