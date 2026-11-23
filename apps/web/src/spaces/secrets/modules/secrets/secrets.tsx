import { secrets } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { ViewerNotice } from "@/features/viewer-notice";
import { SecretsQuery } from "./query";
import { SecretsPage } from "./secrets-page";

export async function Secrets({ query }: { readonly query: Query }) {
  const creating = SecretsQuery.parse(query).new;
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <ViewerNotice what="Secrets hold the passwords, tokens and keys your steps call services with." />
    );

  const list = await available(secrets());

  if (list === UNAVAILABLE) return <Unavailable />;

  return <SecretsPage secrets={list} creating={creating} />;
}
