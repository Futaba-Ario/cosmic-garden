import { describe, expect, it } from 'vitest';
import { resolveGithubPagesBase } from '../../src/config/githubPages';

describe('resolveGithubPagesBase', () => {
  it('uses the site root outside GitHub Actions', () => {
    expect(resolveGithubPagesBase({})).toBe('/');
  });

  it('uses the site root for an account Pages repository', () => {
    expect(resolveGithubPagesBase({
      GITHUB_REPOSITORY: 'octocat/octocat.github.io',
      GITHUB_REPOSITORY_OWNER: 'octocat',
    })).toBe('/');
  });

  it('uses the repository name for a project Pages repository', () => {
    expect(resolveGithubPagesBase({
      GITHUB_REPOSITORY: 'octocat/cosmic-garden',
      GITHUB_REPOSITORY_OWNER: 'octocat',
    })).toBe('/cosmic-garden/');
  });

  it('prefers and normalises an explicit base-path override', () => {
    expect(resolveGithubPagesBase({
      PAGES_BASE_PATH: ' //preview//cosmic-garden// ',
      GITHUB_REPOSITORY: 'octocat/cosmic-garden',
      GITHUB_REPOSITORY_OWNER: 'octocat',
    })).toBe('/preview/cosmic-garden/');
  });

  it('allows a root override', () => {
    expect(resolveGithubPagesBase({ PAGES_BASE_PATH: '/' })).toBe('/');
  });
});
