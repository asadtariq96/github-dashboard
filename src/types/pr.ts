export type LifecycleStatus = 'Draft' | 'Ready for Review';

export type ReviewStatus = 'Approved' | 'Changes Requested' | 'Review Required' | 'Awaiting Author';

export type ChecksStatus = 'Passing' | 'Failing' | 'Warning' | 'Running' | 'Pending' | 'None';

export type MergeabilityStatus =
  | 'Ready to Merge'
  | 'In Merge Queue'
  | 'Merge Conflicts'
  | 'Behind Base Branch'
  | 'Blocked by Policy'
  | 'Unknown';

export interface MergeQueueInfo {
  state: string; // e.g. QUEUED, AWAITING_CHECKS, MERGEABLE, LOCKED
  position?: number;
  url?: string;
  isWaitingForApproval?: boolean;
  approvalStepName?: string;
  approvalStepUrl?: string;
  runId?: number;
  environmentIds?: number[];
}

export interface CheckRunItem {
  id: string;
  name: string;
  status: string; // e.g. COMPLETED, IN_PROGRESS, QUEUED
  conclusion: string | null; // e.g. SUCCESS, FAILURE, TIMED_OUT, SKIPPED, CANCELLED
  detailsUrl: string | null;
  isRequired?: boolean;
}

export interface ReviewThreadItem {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  author: string;
  authorAvatarUrl?: string;
  bodyPreview: string;
  createdAt: string;
  url: string;
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
  
  // 5 Orthogonal Dimensions
  lifecycle: LifecycleStatus;
  review: ReviewStatus;
  checks: ChecksStatus;
  mergeability: MergeabilityStatus;
  unresolvedThreadsCount: number;

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
  ts: string;      // ISO
  url: string;
  text: string;    // truncated
  state: string;   // review state: approved | changes_requested | commented | ''
  bot: boolean;
}

export interface PrActivityInfo {
  since: string;   // ISO of the viewer's last own activity on the PR
  items: ActivityItem[]; // new activity by OTHERS after `since`, newest first, max 30
}

export interface DashboardSyncResponse {
  prs: PullRequestAssessment[];
  lastUpdated: string;
  query: string;
  syncStatus: 'Healthy' | 'Syncing' | 'Stale Error';
  error?: string;
  activity: Record<string, PrActivityInfo>; // keyed `${repo}#${number}`
}
