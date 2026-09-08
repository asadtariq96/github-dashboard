#!/usr/bin/env node
/**
 * Put the captured pairs into the pull request body.
 *
 *   node tools/pr-screenshots/post.mjs \
 *     --pr 5 --shots-dir /tmp/pr-shots \
 *     --routes /design/cards --themes light,dark
 *
 * The images are committed to a `pr-screenshots` branch through the GitHub
 * contents API, and the body references them with the `github.com/<repo>/raw/`
 * form. That form is served by github.com itself, so a private repository shows
 * the images to anyone who can read the repository. It needs no extra token:
 * the workflow's own GITHUB_TOKEN is enough, with `contents: write`.
 *
 * The body block lives between two markers, so a second run replaces its own
 * output and leaves the rest of the description alone.
 *
 * Flags: --pr (required), --shots-dir (required), --routes, --themes,
 *        --repo, --branch, --commit, --mode body|comment, --dry-run
 */

import { access, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { BLOCK_START, BLOCK_END, parseArgs, shotName } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), {
  pr: '',
  'shots-dir': '',
  routes: '/design/cards',
  themes: 'light,dark',
  repo: '',
  branch: 'pr-screenshots',
  commit: '',
  mode: 'body',
  'dry-run': '',
});

if (!args.pr || !args['shots-dir']) {
  console.error('--pr and --shots-dir are required');
  process.exit(1);
}

const pr = String(args.pr);
const routes = args.routes.split(',').map((r) => r.trim()).filter(Boolean);
const themes = args.themes.split(',').map((t) => t.trim()).filter(Boolean);

function gh(ghArgs, input) {
  const result = spawnSync('gh', ghArgs, { input, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gh ${ghArgs.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

const repo = args.repo || gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);

function ensureBranch() {
  const ref = `/repos/${repo}/git/ref/heads/${args.branch}`;
  const found = spawnSync('gh', ['api', ref], { encoding: 'utf8' });
  if (found.status === 0) return;
  const base = gh(['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
  const sha = gh(['api', `/repos/${repo}/git/ref/heads/${base}`, '--jq', '.object.sha']);
  gh(['api', '--method', 'POST', `/repos/${repo}/git/refs`, '-f', `ref=refs/heads/${args.branch}`, '-f', `sha=${sha}`]);
  console.log(`created branch ${args.branch} at ${sha.slice(0, 7)}`);
}

function upload(file, filePath) {
  const remotePath = `pr-${pr}/${file}`;
  const content = Buffer.from(readFileSync(filePath)).toString('base64');
  const body = (sha) => JSON.stringify({
    message: `screenshots for #${pr}`,
    content,
    branch: args.branch,
    ...(sha ? { sha } : {}),
  });
  const put = (sha) => spawnSync(
    'gh',
    ['api', '--method', 'PUT', `/repos/${repo}/contents/${remotePath}`, '--input', '-', '--jq', '.commit.sha'],
    { input: body(sha), encoding: 'utf8' },
  );

  let result = put();
  if (result.status !== 0 && /already exists|supplied/i.test(`${result.stderr}${result.stdout}`)) {
    const current = gh(['api', `/repos/${repo}/contents/${remotePath}?ref=${args.branch}`, '--jq', '.sha']);
    result = put(current);
  }
  if (result.status !== 0) {
    throw new Error(`upload of ${file} failed:\n${result.stderr || result.stdout}`);
  }
  const sha = result.stdout.trim();
  // The blob form is the one GitHub resolves with the viewer's own
  // authentication, which is what makes a private repository work. The commit
  // SHA also removes any ambiguity when a branch name contains a slash.
  return `https://github.com/${repo}/blob/${sha}/${remotePath}?raw=true`;
}

const shots = [];
for (const route of routes) {
  for (const theme of themes) {
    for (const variant of ['before', 'after']) {
      const file = shotName({ variant, route, theme });
      shots.push({ route, theme, variant, file, path: path.join(args['shots-dir'], file) });
    }
  }
}

for (const shot of shots) {
  try {
    await access(shot.path);
  } catch {
    console.error(`missing capture: ${shot.path}`);
    process.exit(1);
  }
}

function blockFor(urlOf) {
  const rows = [];
  for (const route of routes) {
    for (const theme of themes) {
      const before = shots.find((s) => s.route === route && s.theme === theme && s.variant === 'before');
      const after = shots.find((s) => s.route === route && s.theme === theme && s.variant === 'after');
      const image = (shot) => {
        const alt = `${shot.variant} ${shot.route} (${shot.theme})`;
        const url = urlOf(shot);
        return url ? `![${alt}](${url})` : `![${alt}](./${shot.file})`;
      };
      rows.push(`| \`${route}\` | ${theme} | ${image(before)} | ${image(after)} |`);
    }
  }
  const lines = [
    BLOCK_START,
    '### Before and after',
    '',
    '| route | theme | before | after |',
    '| --- | --- | --- | --- |',
    ...rows,
  ];
  if (args.commit) {
    lines.push('', `Captured from \`${args.commit.slice(0, 7)}\` and its base.`);
  }
  lines.push(BLOCK_END);
  return lines.join('\n');
}

function withBlock(body, block) {
  // Match the markers only when they sit alone on a line. The markers are
  // written about in prose, and an inline mention must not be mistaken for the
  // block itself.
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line.trim() === BLOCK_START);
  const end = lines.findIndex((line) => line.trim() === BLOCK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const next = [...lines.slice(0, start), ...block.split('\n'), ...lines.slice(end + 1)];
    return `${next.join('\n').trimEnd()}\n`;
  }
  return `${body.trimEnd()}\n\n${block}\n`;
}

if (args['dry-run']) {
  console.log(blockFor(() => null));
  console.log(`\nwould upload ${shots.length} files to ${repo}@${args.branch} and edit #${pr}`);
  process.exit(0);
}

ensureBranch();

const urls = new Map();
for (const shot of shots) {
  urls.set(shot.file, upload(shot.file, shot.path));
  console.log(`uploaded ${shot.file}`);
}

const block = blockFor((shot) => urls.get(shot.file));
const bodyPath = path.join(args['shots-dir'], 'body.md');
const current = args.mode === 'body'
  ? gh(['pr', 'view', pr, '--repo', repo, '--json', 'body', '--jq', '.body'])
  : '';
const next = args.mode === 'body' ? withBlock(current, block) : block;
await writeFile(bodyPath, next);

if (args.mode === 'body') {
  gh(['pr', 'edit', pr, '--repo', repo, '--body-file', bodyPath]);
  const saved = gh(['pr', 'view', pr, '--repo', repo, '--json', 'body', '--jq', '.body']);
  const relative = saved.match(/\]\(\.\//g) ?? [];
  if (relative.length > 0) {
    console.error(`the saved body still has ${relative.length} relative image reference(s)`);
    process.exit(1);
  }
  console.log(`edited ${repo}#${pr}: ${shots.length} images, ${relative.length} relative references left`);
} else {
  gh(['pr', 'comment', pr, '--repo', repo, '--body-file', bodyPath]);
  console.log(`commented on ${repo}#${pr}`);
}
