import { webhooks } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import { WebhooksPage } from "./webhooks-page";

export async function Webhooks() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what="Webhooks let other apps send events in." />;

  const list = await available(webhooks());

  if (list === UNAVAILABLE) return <Unavailable />;

  return <WebhooksPage webhooks={list} />;
}
