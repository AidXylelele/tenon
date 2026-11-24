import { notFound } from "next/navigation";
import {
  hostProfile,
  subscription as subscriptionOf,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { segment } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import {
  NOTIFICATIONS_PURPOSE,
  runEventsOf,
} from "../../__shared_context/notifications";
import { NotificationPage } from "./notification-page";

export async function NotificationDetail({
  params,
}: {
  readonly params: { readonly id: string };
}) {
  const id = segment(params.id);
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what={NOTIFICATIONS_PURPOSE} />;

  const read = await available(
    Promise.all([subscriptionOf(id), hostProfile()]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [subscription, profile] = read;

  if (subscription === null) notFound();

  const runEvents = runEventsOf(profile);

  return <NotificationPage subscription={subscription} runEvents={runEvents} />;
}
