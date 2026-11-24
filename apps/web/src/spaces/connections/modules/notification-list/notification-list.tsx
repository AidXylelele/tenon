import { hostProfile, subscriptions } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import {
  NOTIFICATIONS_PURPOSE,
  runEventsOf,
} from "../../__shared_context/notifications";
import { NotificationListPage } from "./notification-list-page";

export async function NotificationList() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what={NOTIFICATIONS_PURPOSE} />;

  const read = await available(Promise.all([subscriptions(), hostProfile()]));

  if (read === UNAVAILABLE) return <Unavailable />;

  const [list, profile] = read;
  const runEvents = runEventsOf(profile);

  return <NotificationListPage subscriptions={list} runEvents={runEvents} />;
}
