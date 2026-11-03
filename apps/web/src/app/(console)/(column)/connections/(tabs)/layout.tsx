import { PageHeader } from '@/libs/ui/composites/page-header';
import { SectionTabs } from '@/libs/ui/composites/section-tabs';
import {
  NOTIFICATIONS_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
} from '@/operations/app-routes';

const TABS = [
  { href: WEBHOOKS_HREF, label: 'Webhooks' },
  { href: NOTIFICATIONS_HREF, label: 'Notifications' },
  { href: TEST_EVENT_HREF, label: 'Test event' },
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
