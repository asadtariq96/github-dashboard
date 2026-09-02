import { DashboardView } from '../../components/DashboardView';

export const metadata = { title: 'My PRs · PR Desk' };

export default function MinePage() {
  return <DashboardView mode="mine" />;
}
