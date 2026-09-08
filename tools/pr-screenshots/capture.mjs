#!/usr/bin/env node
/**
 * Capture the same routes from one running app variant.
 *
 *   node tools/pr-screenshots/capture.mjs \
 *     --base-url http://127.0.0.1:3100 \
 *     --variant before \
 *     --out /tmp/pr-shots \
 *     --routes /design/cards \
 *     --themes light,dark
 *
 * Writes <out>/<variant>-<route>-<theme>.png and merges a manifest.json.
 * Run it once per variant against the same routes so the pairs line up.
 *
 * Modes, in the order they are tried:
 *   --selector <css>   clip to the first match (a single card, readable in a PR)
 *   --full-page        the whole scrollable page (pre-scrolled so lazy content paints)
 *   (default)          the viewport, after --scroll-to top|bottom
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { list, parseArgs, require_, shotName } from './lib.mjs';

// The app reads this key on mount and copies it to <html data-theme>.
const THEME_STORAGE_KEY = 'gh_dashboard_theme';

const args = parseArgs(process.argv.slice(2), {
  'base-url': '',
  variant: '',
  out: '',
  routes: '/design/cards',
  themes: 'light,dark',
  width: 1280,
  height: 900,
  scale: 2,
  settle: 900,
  timeout: 60000,
  selector: '',
  'scroll-to': 'top',
  'full-page': '',
  unclip: '',
});

const UNCLIP_CSS = `html, body { height: auto !important; overflow: visible !important; }
.scroll-region { height: auto !important; max-height: none !important; overflow: visible !important; }`;

const baseUrl = require_(args['base-url'], 'base-url').replace(/\/$/, '');
const variant = require_(args.variant, 'variant');
const outDir = require_(args.out, 'out');
const routes = list(args.routes);
const themes = list(args.themes);
const fullPage = Boolean(args['full-page']);

if (!['top', 'bottom'].includes(args['scroll-to'])) {
  throw new Error(`--scroll-to must be top or bottom, got ${args['scroll-to']}`);
}

await mkdir(outDir, { recursive: true });

/** Walk the page so anything revealed on scroll has painted by capture time. */
async function revealEverything(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
}

async function capture(page, file, selector) {
  const shotPath = path.join(outDir, file);

  if (args.unclip) {
    // The app shell keeps `html, body` at viewport height with `overflow: hidden`
    // and scrolls inside `.scroll-region` elements. That is right for the
    // dashboard and wrong for a design page that wants to be one long page, so
    // undo it for the length of the capture only.
    await page.addStyleTag({ content: UNCLIP_CSS });
    await page.waitForTimeout(250);
  }

  if (selector) {
    const target = await page.$(selector);
    if (target) {
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await target.screenshot({ path: shotPath, animations: 'disabled', caret: 'hide' });
      return { file, selector };
    }
    console.warn(`selector ${selector} not found on ${variant} ${file}; capturing the viewport`);
  }

  if (fullPage) {
    await revealEverything(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shotPath, fullPage: true, animations: 'disabled', caret: 'hide' });
    return { file, mode: 'full-page' };
  }

  if (args['scroll-to'] === 'bottom') {
    await revealEverything(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: shotPath, animations: 'disabled', caret: 'hide' });
  return { file, mode: `viewport:${args['scroll-to']}` };
}

const browser = await chromium.launch();
const shots = [];

for (const theme of themes) {
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.scale,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_STORAGE_KEY, theme],
  );

  for (const route of routes) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: args.timeout });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(args.settle);
    const file = shotName({ variant, route, theme });
    const detail = await capture(page, file, args.selector);
    shots.push({ variant, route, theme, ...detail });
    console.log(`captured ${variant} ${route} ${theme} -> ${file}`);
    await page.close();
  }

  await context.close();
}

await browser.close();

// Merge into a manifest so a later run of the other variant keeps both halves.
const manifestPath = path.join(outDir, 'manifest.json');
let manifest = [];
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
  manifest = [];
}
const byKey = new Map(manifest.map((shot) => [`${shot.variant}|${shot.route}|${shot.theme}`, shot]));
for (const shot of shots) byKey.set(`${shot.variant}|${shot.route}|${shot.theme}`, shot);
await writeFile(manifestPath, `${JSON.stringify([...byKey.values()], null, 2)}\n`);

console.log(`wrote ${shots.length} screenshot(s) to ${outDir}`);
