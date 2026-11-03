import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { EventSender } from './event-sender';

export async function EventSenderPage() {
  const user = await currentUser();

  if (!canAuthor(user))
    return <AuthorsOnly what="Sending events starts and resumes workflows." />;

  return (
    <>
      <PageHeader
        title="Send an event"
        description="Try a trigger, a waiting step or a subscription with a CloudEvent, as another application would send it."
      />
      <EventSender />
    </>
  );
}
