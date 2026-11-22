import { hostProfile, secrets } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { NOTIFICATIONS_HREF, WEBHOOKS_HREF } from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import { NOTIFICATIONS_PURPOSE } from "../../__shared_context/notifications";
import { SubscriptionEditor } from "./subscription-editor";

const PRESETS = [
  { label: "Any run that fails", event: "workflow.faulted" },
  { label: "Any run that completes", event: "workflow.completed" },
];

export async function NotificationForm() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <>
        <PageHeader title="New notification" />
        <ViewerNotice what={NOTIFICATIONS_PURPOSE} />
      </>
    );

  const read = await available(Promise.all([secrets(), hostProfile()]));

  if (read === UNAVAILABLE) return <Unavailable />;

  const [owned, profile] = read;
  const secretNames = owned.map((secret) => secret.name);
  const presets = PRESETS.flatMap((preset) => {
    const event = profile.lifecycleEvents.find(
      (each) => each.name === preset.event,
    );
    const type = event?.types[0];
    return type === undefined ? [] : [{ label: preset.label, value: type }];
  });

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Connections", href: WEBHOOKS_HREF },
          { label: "Notifications", href: NOTIFICATIONS_HREF },
          { label: "New" },
        ]}
        title="New notification"
        description="Tell another application about the events it needs: what workflows emit, what comes in, and when runs start and end."
      />
      <SubscriptionEditor secretNames={secretNames} presets={presets} />
    </>
  );
}
