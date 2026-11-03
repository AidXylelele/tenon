import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { SectionTabs } from '@/libs/ui/composites/section-tabs';

// The person's account, the team (administrators) and what the platform supports (research R15).
export default async function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await currentUser();
  const admin = user?.role === 'admin';
  const tabs = [
    { href: '/settings/account', label: 'Account' },
    ...(admin ? [{ href: '/settings/team', label: 'Team' }] : []),
    { href: '/settings/standard', label: 'Standard' },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <SectionTabs tabs={tabs} label="Settings" />
      {children}
    </>
  );
}
