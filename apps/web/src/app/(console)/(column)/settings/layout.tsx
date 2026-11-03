import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { SectionTabs } from '@/libs/ui/composites/section-tabs';
import { isAdministrator } from '@/operations/access-policy';
import {
  ACCOUNT_HREF,
  STANDARD_HREF,
  TEAM_HREF,
} from '@/operations/app-routes';

// The person's account, the team (administrators) and what the platform supports (research R15).
export default async function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await currentUser();
  const admin = isAdministrator(user);
  const tabs = [
    { href: ACCOUNT_HREF, label: 'Account' },
    ...(admin ? [{ href: TEAM_HREF, label: 'Team' }] : []),
    { href: STANDARD_HREF, label: 'Standard' },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <SectionTabs tabs={tabs} label="Settings" />
      {children}
    </>
  );
}
