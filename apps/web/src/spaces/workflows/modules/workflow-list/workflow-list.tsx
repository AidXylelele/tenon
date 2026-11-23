import { workflows } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { workflowsHref } from "@/libs/routing/routes";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { WorkflowListQuery } from "./query";
import { WorkflowListPage } from "./workflow-list-page";

export async function WorkflowList({ query }: { readonly query: Query }) {
  const address = WorkflowListQuery.parse(query);
  const status = address.status;
  const cursor = address.cursor;
  const q = address.q;
  const read = await available(
    Promise.all([currentSession(), workflows(status, cursor, q)]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, page] = read;
  const author = session?.capabilities.author === true;
  const firstPage = cursor === undefined ? null : workflowsHref({ status, q });
  const nextPage =
    page.next === null ? null : workflowsHref({ status, cursor: page.next, q });

  return (
    <WorkflowListPage
      status={status}
      q={q}
      workflows={page.items}
      author={author}
      firstPage={firstPage}
      nextPage={nextPage}
    />
  );
}
