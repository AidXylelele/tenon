import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { AccountPage } from "./account-page";

export async function Account() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const user = session?.user ?? null;

  if (user === null) return null;

  return <AccountPage user={user} />;
}
