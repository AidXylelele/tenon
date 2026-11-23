import { available, UNAVAILABLE } from "@/libs/data-access/http";
import {
  currentSession,
  invitations,
  members,
} from "@/libs/data-access/identity";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { PeoplePage } from "./people-page";

export async function People() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const administrator = session?.capabilities.administrator === true;

  if (!administrator)
    return (
      <EmptyState
        title="Only administrators invite people"
        description="Ask an administrator to invite someone for you."
      />
    );

  const read = await available(Promise.all([members(), invitations()]));

  if (read === UNAVAILABLE) return <Unavailable />;

  const [people, list] = read;

  return <PeoplePage people={people} list={list} />;
}
