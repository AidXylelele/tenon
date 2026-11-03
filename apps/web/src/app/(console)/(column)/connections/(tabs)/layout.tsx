import { PageHeader } from '@/libs/ui/composites/page-header';
import { SectionTabs } from '@/libs/ui/composites/section-tabs';

const TABS = [
  { href: '/connections/webhooks', label: 'Webhooks' },
  { href: '/connections/notifications', label: 'Notifications' },
  { href: '/connections/test-event', label: 'Test event' },
];

// How other applications start workflows and hear what happened (research R15).
export default function ConnectionsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Connections"
        description="How other applications start your workflows, and how they hear what happened."
      />
      <SectionTabs tabs={TABS} label="Connections" />
      {children}
    </>
  );
}
