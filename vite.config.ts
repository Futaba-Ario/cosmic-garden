import { defineConfig } from 'vitest/config';
import { resolveGithubPagesBase } from './src/config/githubPages';

export default defineConfig({
  base: resolveGithubPagesBase(process.env),
  server: { host: '127.0.0.1' },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
