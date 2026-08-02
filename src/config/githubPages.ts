export interface GithubPagesEnvironment {
  PAGES_BASE_PATH?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_REPOSITORY_OWNER?: string;
}

function normaliseBasePath(path: string): string {
  const segments = path
    .trim()
    .replaceAll('\\', '/')
    .split(/[?#]/, 1)[0]
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}

/**
 * Resolves Vite's public base path for a GitHub Pages deployment.
 *
 * A `PAGES_BASE_PATH` override is useful for custom Pages routes and local
 * production previews. GitHub Actions otherwise supplies the repository
 * metadata used to distinguish a project site from an account site.
 */
export function resolveGithubPagesBase(environment: GithubPagesEnvironment): string {
  const override = environment.PAGES_BASE_PATH;
  if (override?.trim()) return normaliseBasePath(override);

  const repository = environment.GITHUB_REPOSITORY;
  if (!repository) return '/';

  const [owner, repositoryName, ...extra] = repository.split('/');
  if (!owner || !repositoryName || extra.length > 0) return '/';

  const repositoryOwner = environment.GITHUB_REPOSITORY_OWNER ?? owner;
  if (repositoryName.toLowerCase() === `${repositoryOwner}.github.io`.toLowerCase()) return '/';

  return normaliseBasePath(repositoryName);
}
