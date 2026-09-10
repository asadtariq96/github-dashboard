import type { CheckRunItem, PullRequestAssessment, ReviewThreadItem } from '../../types/pr';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function check(
  name: string,
  status: string,
  conclusion: string | null,
  minutesAgo: number,
  isRequired = true,
): CheckRunItem {
  const stamp = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id: `${name}-${status}-${conclusion}`,
    name,
    status,
    conclusion,
    detailsUrl: 'https://github.com/unity/gateway-api/actions/runs/1',
    isRequired,
    startedAt: stamp,
    completedAt: conclusion ? stamp : undefined,
  };
}

function thread(
  path: string,
  line: number,
  author: string,
  bodyPreview: string,
  hours: number,
  replyLogins: string[] = [],
): ReviewThreadItem {
  const logins = [author, ...replyLogins];
  return {
    id: `${path}-${line}`,
    isResolved: false,
    isOutdated: false,
    path,
    line,
    startLine: null,
    diffSide: 'RIGHT',
    viewerCanReply: true,
    viewerCanResolve: true,
    viewerCanUnresolve: false,
    author,
    bodyPreview,
    createdAt: hoursAgo(hours),
    url: 'https://github.com/unity/gateway-api/pull/2457',
    replyCount: replyLogins.length,
    replies: replyLogins.map((login) => ({ login })),
    comments: logins.map((login, i) => ({
      id: `${path}-${line}-${i}`,
      author: login,
      bodyHTML: i === 0 ? `<p>${bodyPreview}</p>` : '<p>Good catch, pushing a fix now.</p>',
      bodyText: i === 0 ? bodyPreview : 'Good catch, pushing a fix now.',
      createdAt: hoursAgo(hours - i * 0.1),
      url: 'https://github.com/unity/gateway-api/pull/2457',
    })),
  };
}

const SAMPLE_BODY = `
<h2>What this changes</h2>
<p>The event bus consumer now streams records instead of buffering a whole batch in memory.
Closes <a href="#">#2401</a>, and picks up the header work from <a href="#">@lexi-m</a>.</p>
<ul class="contains-task-list">
<li class="task-list-item"><input type="checkbox" checked disabled> Stream records through <code>consumer.Next()</code></li>
<li class="task-list-item"><input type="checkbox" checked disabled> Back-pressure when the sink is slow</li>
<li class="task-list-item"><input type="checkbox" disabled> Metrics for dropped records</li>
</ul>
<h3>Why</h3>
<blockquote><p>A 400MB batch took the pod over its memory limit twice last week.</p></blockquote>
<pre><code>consumer := bus.NewStreamingConsumer(cfg)
for rec := range consumer.Records(ctx) {
    sink.Write(rec)
}
</code></pre>
<table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead>
<tbody><tr><td>Peak memory</td><td>412 MB</td><td>38 MB</td></tr>
<tr><td>p99 latency</td><td>1.8s</td><td>240ms</td></tr></tbody></table>
<div class="markdown-alert markdown-alert-warning">
<p class="markdown-alert-title">Warning</p>
<p>The consumer group offset resets once on deploy. Drain the queue first.</p>
</div>
`;

const base: PullRequestAssessment = {
  id: 'base',
  number: 2457,
  title: 'Add streaming support to event bus consumer',
  url: 'https://github.com/unity/gateway-api/pull/2457',
  repository: { nameWithOwner: 'unity/gateway-api', url: 'https://github.com/unity/gateway-api' },
  author: { login: 'asad', avatarUrl: '' },
  headRefName: 'feature/streaming-consumer',
  baseRefName: 'main',
  isDraft: false,
  createdAt: hoursAgo(24 * 21),
  updatedAt: hoursAgo(1),
  additions: 312,
  deletions: 48,
  changedFiles: 14,
  bodyHTML: SAMPLE_BODY,
  lifecycle: 'Ready for Review',
  review: 'Review Required',
  checks: 'Failing',
  mergeability: 'Blocked by Policy',
  unresolvedThreadsCount: 2,
  viewerReview: 'None',
  viewerReviewStale: false,
  isStacked: false,
  needsAttention: true,
  isInMergeQueue: false,
  hasRepoMergeQueue: true,
  canUpdateBranch: false,
  checkRuns: [
    check('Integration / e2e (us-central1)', 'COMPLETED', 'FAILURE', 2),
    check('Lint (golangci-lint)', 'COMPLETED', 'FAILURE', 5),
    check('Redis cluster multi-node benchmark', 'IN_PROGRESS', null, 2),
    check('Unit tests & coverage (go 1.22)', 'COMPLETED', 'SUCCESS', 3),
    check('Build container image', 'COMPLETED', 'SUCCESS', 8),
    check('License scan', 'COMPLETED', 'SKIPPED', 9, false),
  ],
  unresolvedThreads: [
    thread('event/consumer.go', 142, 'lexi-m', 'Nit: can we extract this into a function?', 0.3, [
      'asad',
      'omar-k',
    ]),
    thread(
      'docs/architecture.md',
      87,
      'omar-k',
      'This section is out of date with the new flow.',
      2,
      ['asad'],
    ),
  ],
  prComments: [
    {
      id: 'prc1',
      author: 'omar-k',
      bodyHTML: '<p>Please rebase before this goes in.</p>',
      bodyText: 'Please rebase before this goes in.',
      createdAt: hoursAgo(4),
      url: 'https://github.com/acme/platform/pull/2487#issuecomment-1',
    },
  ],
};

export const FIXTURES: { label: string; pr: PullRequestAssessment }[] = [
  { label: 'Failing checks, unresolved threads', pr: base },
  {
    label: 'In the merge queue',
    pr: {
      ...base,
      id: 'queued',
      number: 2489,
      title: 'Refactor rate limiter storage to Redis cluster',
      headRefName: 'refactor/redis-limiter',
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(0.07),
      additions: 184,
      deletions: 92,
      changedFiles: 9,
      review: 'Approved',
      checks: 'Running',
      mergeability: 'In Merge Queue',
      isInMergeQueue: true,
      needsAttention: false,
      unresolvedThreadsCount: 0,
      unresolvedThreads: [],
      mergeQueueInfo: {
        state: 'QUEUED',
        position: 2,
        url: 'https://github.com/unity/gateway-api/queue/main',
      },
      checkRuns: base.checkRuns.filter((c) => c.conclusion !== 'FAILURE'),
    },
  },
  {
    label: 'Draft, and behind its base branch',
    pr: {
      ...base,
      id: 'draft',
      canUpdateBranch: true,
      number: 2512,
      title: 'Implement distributed tracing with OpenTelemetry',
      headRefName: 'feat/otel-tracing',
      isDraft: true,
      lifecycle: 'Draft',
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(3),
      additions: 450,
      deletions: 12,
      changedFiles: 22,
      checks: 'None',
      review: 'Review Required',
      mergeability: 'Blocked by Policy',
      needsAttention: false,
      unresolvedThreadsCount: 0,
      unresolvedThreads: [],
      checkRuns: [],
    },
  },
  {
    label: 'Merge conflicts',
    pr: {
      ...base,
      id: 'conflict',
      number: 2470,
      title: 'Migrate auth middleware to JWT v2 spec',
      headRefName: 'refactor/jwt-v2',
      createdAt: hoursAgo(24 * 7),
      updatedAt: hoursAgo(5),
      additions: 94,
      deletions: 160,
      changedFiles: 6,
      checks: 'Passing',
      review: 'Approved',
      mergeability: 'Merge Conflicts',
      unresolvedThreadsCount: 0,
      unresolvedThreads: [],
      checkRuns: base.checkRuns.filter((c) => c.conclusion !== 'FAILURE'),
    },
  },
  {
    label: 'Deployment waiting for your approval',
    pr: {
      ...base,
      id: 'deploy',
      number: 2501,
      title: 'Promote gateway release 4.12 to production',
      headRefName: 'release/4.12',
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(0.2),
      additions: 12,
      deletions: 4,
      changedFiles: 2,
      checks: 'Pending',
      review: 'Approved',
      mergeability: 'In Merge Queue',
      isInMergeQueue: true,
      unresolvedThreadsCount: 0,
      unresolvedThreads: [],
      mergeQueueInfo: {
        state: 'AWAITING_CHECKS',
        position: 1,
        url: 'https://github.com/unity/gateway-api/queue/main',
        isWaitingForApproval: true,
        approvalStepName: 'Deploy / production (manual approval)',
      },
      checkRuns: [check('Deploy / production (manual approval)', 'IN_PROGRESS', null, 12)],
    },
  },
  {
    label: 'Approved and ready to merge',
    pr: {
      ...base,
      id: 'ready',
      number: 2518,
      title: 'Drop the legacy websocket fallback path',
      headRefName: 'chore/drop-ws-fallback',
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(0.5),
      additions: 8,
      deletions: 214,
      changedFiles: 5,
      checks: 'Passing',
      review: 'Approved',
      mergeability: 'Ready to Merge',
      needsAttention: false,
      unresolvedThreadsCount: 0,
      unresolvedThreads: [],
      checkRuns: base.checkRuns.filter((c) => c.conclusion !== 'FAILURE'),
    },
  },
];
