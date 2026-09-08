/**
 * Shared helpers for the pull-request screenshot tool.
 */

export const BLOCK_START = '<!-- pr-screenshots:start -->';
export const BLOCK_END = '<!-- pr-screenshots:end -->';

/** Parse `--flag value` pairs against a spec of defaults. */
export function parseArgs(argv, defaults) {
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`);
    const key = flag.slice(2);
    if (!(key in out)) throw new Error(`unknown flag: ${flag}`);
    const value = argv[i + 1];
    // A flag with no value, or with another flag after it, is a switch.
    if (value === undefined || value.startsWith('--')) {
      out[key] = typeof out[key] === 'number' ? out[key] : '1';
      continue;
    }
    out[key] = typeof out[key] === 'number' ? Number(value) : value;
    i += 1;
  }
  return out;
}

/** `/design/cards` -> `design-cards`, `/` -> `root`. */
export function slug(route) {
  const clean = route.split('?')[0].replace(/^\/+|\/+$/g, '');
  return (clean === '' ? 'root' : clean).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
}

/** The file name one capture writes and the other reads. */
export function shotName({ variant, route, theme }) {
  return `${variant}-${slug(route)}-${theme}.png`;
}

/** Split a comma list, drop blanks. */
export function list(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function require_(value, name) {
  if (!value) throw new Error(`--${name} is required`);
  return value;
}
