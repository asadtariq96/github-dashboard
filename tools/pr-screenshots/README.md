# Pull request screenshots

Build the base branch and the pull request head, screenshot the same routes from
both, and put the pairs into the pull request body. The workflow in
`.github/workflows/pr-screenshots.yml` runs this on every push to a pull request.

The body block sits between `<!-- pr-screenshots:start -->` and
`<!-- pr-screenshots:end -->`, so re-running the tool replaces its own output and
leaves the prose you wrote alone.

## Run it locally

Start the two variants on two ports. A worktree for the base branch and one for
the pull request is enough:

    git worktree add --detach /tmp/ghdash-before main
    git worktree add --detach /tmp/ghdash-after feat/my-branch
    (cd /tmp/ghdash-before && npm ci && npm run dev -- -p 3100) &
    (cd /tmp/ghdash-after && npm ci && npm run dev -- -p 3101) &

Then capture and post:

    node tools/pr-screenshots/capture.mjs --base-url http://127.0.0.1:3100 \
      --variant before --out /tmp/pr-shots --routes /design/cards --themes light,dark \
      --full-page 1 --unclip 1
    node tools/pr-screenshots/capture.mjs --base-url http://127.0.0.1:3101 \
      --variant after --out /tmp/pr-shots --routes /design/cards --themes light,dark \
      --full-page 1 --unclip 1
    node tools/pr-screenshots/post.mjs --pr 5 --shots-dir /tmp/pr-shots \
      --routes /design/cards --themes light,dark

`post.mjs --dry-run` prints the block and the upload plan without touching the
pull request.

## capture.mjs

| flag | meaning |
| --- | --- |
| `--base-url` | where the variant is running |
| `--variant` | `before` or `after`, used in the file name |
| `--out` | output directory, plus `manifest.json` |
| `--routes` | comma-separated paths, default `/design/cards` |
| `--themes` | comma-separated, default `light,dark` |
| `--width`, `--height`, `--scale` | viewport, default 1280x900 at scale 2 |
| `--settle` | extra wait after load, default 900 ms |
| `--selector` | screenshot one element instead of the page |
| `--scroll-to` | `top` or `bottom` before a viewport shot |
| `--full-page` | capture past the fold |
| `--unclip` | undo `html, body { overflow: hidden }` for the capture |

The theme comes from `localStorage.gh_dashboard_theme`, the same key the app
uses, so the capture matches what a person would see.

## post.mjs

Commits each capture to a `pr-screenshots` branch through the GitHub contents
API, then writes the body with blob URLs:

    https://github.com/<owner>/<repo>/blob/<commit-sha>/pr-<number>/<file>.png?raw=true

That form is the one GitHub resolves with the viewer's own authentication, so a
private repository shows the images to anyone who can read it. It needs no extra
token: the workflow's `GITHUB_TOKEN` is enough, with `contents: write`. The
commit SHA also keeps the URL unambiguous when a branch name contains a slash.

The branch is created on first use. Re-runs overwrite `pr-<number>/<file>.png`
and replace the block, so nothing piles up in the description.

`--mode comment` posts a comment instead of editing the body. A comment cannot
be rewritten in place, so it keeps the references gh appends.

## Notes

- Images live on a `pr-screenshots` branch, never on a branch you merge. Delete
  the branch when you want them gone.
- `--unclip` exists because the app shell sets `html, body { height: 100%;
  overflow: hidden }` and scrolls inside `.scroll-region` elements. A design page
  that wants to be one long page is clipped by that rule, so the whole page can
  only be captured with the rule lifted.
- Screenshots are the app, not a mockup. Nothing here fakes data: it runs the
  real build of each variant.
