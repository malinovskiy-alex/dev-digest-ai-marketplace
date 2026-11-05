// Site-wide constants (DD.BASE / SITE / REPO / GH / MKT in the prototype).
export const BASE = import.meta.env.BASE_URL; // '/dev-digest-ai-marketplace/'
export const SITE = 'https://malinovskiy-alex.github.io' + BASE;
export const REPO = 'malinovskiy-alex/dev-digest-ai-marketplace';
export const GH = 'https://github.com/' + REPO;
export const MKT = 'dev-digest-ai';

export const LINKS = {
  contrib: GH + '/blob/main/CONTRIBUTING.md',
  security: GH + '/blob/main/docs/SECURITY.md#5-reporting-a-vulnerability',
  releases: GH + '/blob/main/docs/RELEASES.md',
  discussions: GH + '/discussions/categories/plugins',
  request: GH + '/issues/new?template=plugin-request.yml',
  feed: BASE + 'feed.xml',
  feedAbs: SITE + 'feed.xml',
};
