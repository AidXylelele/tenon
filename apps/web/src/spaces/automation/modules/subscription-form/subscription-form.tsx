import { secrets } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { canAuthor } from '@/operations/access-policy';
import { NOTIFICATIONS_HREF, WEBHOOKS_HREF } from '@/operations/app-routes';
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
        crumbs={[
          { label: 'Connections', href: WEBHOOKS_HREF },
          { label: 'Notifications', href: NOTIFICATIONS_HREF },
          { label: 'New' },
        ]}
        title="New notification"
        description="Tell another application about the events it needs: what workflows emit, what comes in, and when runs start and end."
      />
      <SubscriptionEditor secretNames={owned.map((secret) => secret.name)} />
    </>
  );
}
