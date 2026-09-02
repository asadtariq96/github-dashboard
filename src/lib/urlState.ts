export interface DeskParams {
  view: string;
  repo: string;
  q: string;
  sort: string;
}

const KEYS = ['view', 'repo', 'q', 'sort'] as const;

export function readDeskParams(search: string): Partial<DeskParams> {
  const sp = new URLSearchParams(search);
  const out: Partial<DeskParams> = {};
  for (const key of KEYS) {
    const value = sp.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** Only values that differ from the default reach the URL, so a plain route stays plain. */
export function deskParamsSearch(params: DeskParams, defaults: DeskParams): string {
  const sp = new URLSearchParams();
  for (const key of KEYS) {
    if (params[key] !== defaults[key]) sp.set(key, params[key]);
  }
  const query = sp.toString();
  return query ? `?${query}` : '';
}

export function writeDeskUrl(params: DeskParams, defaults: DeskParams, how: 'push' | 'replace') {
  const url = `${window.location.pathname}${deskParamsSearch(params, defaults)}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (how === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}
