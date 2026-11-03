import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { canAuthor } from '@/operations/access-policy';
import { ViewerNotice } from '@/features/viewer-notice';
import { EventSender } from './event-sender';

export async function TestEvent() {
  const user = await currentUser();

  if (!canAuthor(user))
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
