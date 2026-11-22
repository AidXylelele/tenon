import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { ViewerNotice } from "@/features/viewer-notice";
import { EventSender } from "./event-sender";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export async function TestEvent() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what="Sending events starts and resumes workflows." />;

  return (
    <>
      <PageHeader
        level={2}
        title="Test event"
        description="Try a trigger, a waiting step or a subscription with a CloudEvent, as another application would send it."
      />
      <EventSender />
    </>
  );
}
