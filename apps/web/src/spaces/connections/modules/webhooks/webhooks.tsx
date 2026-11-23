import { webhooks } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import { WebhooksQuery } from "./query";
import { WebhooksPage } from "./webhooks-page";

export async function Webhooks({ query }: { readonly query: Query }) {
  const address = WebhooksQuery.parse(query);
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return <ViewerNotice what="Webhooks let other apps send events in." />;

  const list = await available(webhooks());

  if (list === UNAVAILABLE) return <Unavailable />;

  return (
    <WebhooksPage
      webhooks={list}
      testing={address.test}
      creating={address.new}
    />
  );
}
