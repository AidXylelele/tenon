import { hostProfile, secrets } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import {
  NOTIFICATIONS_PURPOSE,
  runEventsOf,
} from "../../__shared_context/notifications";
import { NotificationFormPage } from "./notification-form-page";

export async function NotificationForm() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what={NOTIFICATIONS_PURPOSE} />;

  const read = await available(Promise.all([secrets(), hostProfile()]));

  if (read === UNAVAILABLE) return <Unavailable />;

  const [owned, profile] = read;
  const secretNames = owned.map((secret) => secret.name);
  const presets = runEventsOf(profile);

  return <NotificationFormPage secretNames={secretNames} presets={presets} />;
}
