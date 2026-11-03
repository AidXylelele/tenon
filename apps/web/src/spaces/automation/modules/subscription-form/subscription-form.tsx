import { secrets } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { SubscriptionEditor } from './subscription-editor';

export async function SubscriptionForm() {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <AuthorsOnly what="Subscriptions deliver events to other applications." />
    );

  const owned = await secrets();

  return (
    <>
      <PageHeader
        title="New subscription"
        description="Deliver the events another application needs: what workflows emit, what comes in, and runs' lifecycle."
      />
      <SubscriptionEditor secretNames={owned.map((secret) => secret.name)} />
    </>
  );
}
