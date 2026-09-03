export type LifecycleStatus = 'Draft' | 'Ready for Review';

export type ReviewStatus = 'Approved' | 'Changes Requested' | 'Review Required' | 'Awaiting Author';

export type ChecksStatus = 'Passing' | 'Failing' | 'Warning' | 'Running' | 'Pending' | 'None';

export type ViewerReviewState =
  | 'Approved'
  | 'Changes Requested'
  | 'Commented'
  | 'Dismissed'
  | 'Pending'
  | 'None';

export type MergeabilityStatus =
  | 'Ready to Merge'
  | 'In Merge Queue'
  | 'Merge Conflicts'
  | 'Behind Base Branch'
  | 'Blocked by Policy'
  | 'Unknown';

export type MergeQueueState = 'QUEUED' | 'AWAITING_CHECKS' | 'MERGEABLE' | 'UNMERGEABLE' | 'LOCKED';

export interface MergeQueueInfo {
  state: string; // e.g. QUEUED, AWAITING_CHECKS, MERGEABLE, LOCKED
  position?: number;
  url?: string;
  isWaitingForApproval?: boolean;
  approvalStepName?: string;
  approvalStepUrl?: string;
  runId?: number;
  environmentIds?: number[];
  entryId?: string;
  enqueuedAt?: string;
  /** Seconds the queue expects this entry still needs. */
  estimatedTimeToMerge?: number;
  /** The queue pulled it out of the batch and is building it alone. */
  solo?: boolean;
  /** It was moved to the front of the queue. */
  jump?: boolean;
}

export interface MergeQueueConfiguration {
  mergeMethod: string | null;
  mergingStrategy: string | null;
  maximumEntriesToBuild: number | null;
  minimumEntriesToMerge: number | null;
  checkResponseTimeout: number | null;
}

export interface MergeQueueDetail {
  state: MergeQueueState | string;
  position: number | null;
  enqueuedAt: string | null;
  estimatedTimeToMerge: number | null;
  solo: boolean;
  jump: boolean;
  enqueuer: string | null;
  url: string | null;
  configuration: MergeQueueConfiguration | null;
  /** The speculative merge commit the queue built, not the pull request's head. */
  headSha: string | null;
  rollupState: string | null;
  checkTotal: number;
  /** The queue's own checks against that commit. */
  checks: CheckRunItem[];
}

export interface CheckRunItem {
  id: string;
  name: string;
  status: string; // e.g. COMPLETED, IN_PROGRESS, QUEUED
  conclusion: string | null; // e.g. SUCCESS, FAILURE, TIMED_OUT, SKIPPED, CANCELLED
  detailsUrl: string | null;
  isRequired?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface ThreadComment {
  id: string;
  author: string;
  authorAvatarUrl?: string;
  /** GitHub's own rendered markdown. Already sanitized by the API. */
  bodyHTML: string;
  bodyText: string;
  createdAt: string;
  url: string;
}

export interface ReviewThreadItem {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: string;
  resolvedBy?: string;
  viewerCanReply: boolean;
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  author: string;
  authorAvatarUrl?: string;
  bodyPreview: string;
  createdAt: string;
  url: string;
  /** Comments after the first one, counting past the page we fetch. */
  replyCount: number;
  /** The repliers we have, capped by the comment page size. */
  replies: { login: string; avatarUrl?: string }[];
  /** Every comment we fetched, oldest first. Drives the expanded thread. */
  comments: ThreadComment[];
}

export type AnnotationLevel = 'FAILURE' | 'WARNING' | 'NOTICE';

export interface CheckAnnotation {
  annotationLevel: AnnotationLevel | null;
  message: string;
  title: string | null;
  path: string;
  rawDetails: string | null;
  blobUrl: string | null;
  startLine: number | null;
  endLine: number | null;
}

export interface CheckStep {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string;
  completedAt?: string;
  secondsToCompletion?: number | null;
}

export interface CheckDetail {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string;
  completedAt?: string;
  detailsUrl: string | null;
  permalink: string | null;
  title: string | null;
  summary: string | null;
  text: string | null;
  steps: CheckStep[];
  annotations: CheckAnnotation[];
  /** Tail of the job log, when the check is an Actions job we can read. */
  logTail?: string;
  logError?: string;
}

export interface StackedParentInfo {
  prNumber: number;
  title: string;
  url: string;
  headRefName: string;
}

export interface PullRequestAssessment {
  id: string;
  number: number;
  title: string;
  url: string;
  repository: {
    nameWithOwner: string;
    url: string;
  };
  author: {
    login: string;
    avatarUrl: string;
  };
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  /** GitHub's own rendered description. Already sanitized by the API. */
  bodyHTML: string;

  // 5 Orthogonal Dimensions
  lifecycle: LifecycleStatus;
  review: ReviewStatus;
  checks: ChecksStatus;
  mergeability: MergeabilityStatus;
  unresolvedThreadsCount: number;

  // Viewer's own standing on this PR. Drives the /reviews mode.
  viewerReview: ViewerReviewState;
  viewerReviewedAt?: string;
  lastCommitAt?: string;
  /** The viewer reviewed, then the author pushed after that review. */
  viewerReviewStale: boolean;

  // Additional triage / flags
  isStacked: boolean;
  stackedParent?: StackedParentInfo;
  needsAttention: boolean;
  isInMergeQueue: boolean;
  hasRepoMergeQueue?: boolean;
  canUpdateBranch?: boolean;
  mergeQueueInfo?: MergeQueueInfo;

  // Detail Drawer items
  checkRuns: CheckRunItem[];
  unresolvedThreads: ReviewThreadItem[];
}

export interface ActivityItem {
  type: 'comment' | 'review' | 'commit';
  author: string;
  ts: string; // ISO
  url: string;
  text: string; // truncated
  state: string; // review state: approved | changes_requested | commented | ''
  bot: boolean;
}

export interface PrActivityInfo {
  since: string; // ISO of the viewer's last own activity on the PR
  items: ActivityItem[]; // new activity by OTHERS after `since`, newest first, max 30
}

export interface DashboardSyncResponse {
  prs: PullRequestAssessment[];
  recentPRs: RecentPullRequest[];
  lastUpdated: string;
  query: string;
  syncStatus: 'Healthy' | 'Syncing' | 'Stale Error';
  error?: string;
  activity: Record<string, PrActivityInfo>; // keyed `${repo}#${number}`
  matchedTotal: number;
  truncated: boolean;
  partial: boolean;
  mode?: 'mine' | 'reviews';
  /** Age in ms of the last sync of every other mode. Null when never synced. */
  otherAges?: Record<string, number | null>;
}

export interface RecentPullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  repository: string;
  outcome: 'Merged' | 'Closed';
  completedAt: string;
}
