import {
  NOTIFICATIONS_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
} from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { RouteTabs } from "@/libs/ui/composites/route-tabs";

const TABS = [
  { href: WEBHOOKS_HREF, label: "Webhooks" },
  { href: NOTIFICATIONS_HREF, label: "Notifications" },
  { href: TEST_EVENT_HREF, label: "Test event" },
];

export function ConnectionsFrame({
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
      <RouteTabs tabs={TABS} label="Connections" />
      {children}
    </>
  );
}
