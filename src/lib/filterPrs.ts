import type { PullRequestAssessment } from '../types/pr';
import type { Mode } from './config';
import type { ViewId } from '../components/Rail';
import { matchesView } from '../components/Rail';
import { isSnoozed, needsAction, type SnoozeMap } from './workQueue';

export interface FilterOptions {
  mode: Mode;
  activeView: ViewId;
  selectedRepo: string;
  searchQuery: string;
  hiddenPRIds: Set<string>;
  snoozedUntil: SnoozeMap;
}

export function filterPrs(prs: PullRequestAssessment[], opts: FilterOptions) {
  const { mode, activeView, selectedRepo, searchQuery, hiddenPRIds, snoozedUntil } = opts;
  const q = searchQuery.trim().toLowerCase();
  return prs.filter((pr) => {
    const isHidden = hiddenPRIds.has(pr.id);
    const snoozed = isSnoozed(snoozedUntil, pr.id);
    if (activeView === 'hidden') {
      if (!isHidden) return false;
    } else {
      if (isHidden) return false;
      if (activeView === 'snoozed') {
        if (!snoozed) return false;
      } else {
        if (snoozed || activeView === 'done-recently') return false;
        if (activeView === 'act-now' && !needsAction(mode, pr)) return false;
        if (activeView === 'waiting' && needsAction(mode, pr)) return false;
        if (
          activeView !== 'act-now' &&
          activeView !== 'waiting' &&
          !matchesView(mode, activeView, pr)
        )
          return false;
      }
    }
    if (selectedRepo !== 'all' && pr.repository.nameWithOwner !== selectedRepo) return false;
    if (q !== '') {
      if (
        !pr.number.toString().includes(q) &&
        !pr.title.toLowerCase().includes(q) &&
        !pr.repository.nameWithOwner.toLowerCase().includes(q) &&
        !pr.headRefName.toLowerCase().includes(q) &&
        !pr.author.login.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}
