import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import {
  ACCOUNT_HREF,
  PEOPLE_HREF,
  PLATFORM_HREF,
} from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { RouteTabs } from "@/libs/ui/composites/route-tabs";
import { Unavailable } from "@/libs/ui/composites/unavailable";

const ACCOUNT = { href: ACCOUNT_HREF, label: "Account" };
const INVITATIONS = { href: PEOPLE_HREF, label: "Invitations" };
const PLATFORM = { href: PLATFORM_HREF, label: "Platform" };

export async function SettingsFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const administrator = session?.capabilities.administrator === true;
  const tabs = administrator
    ? [ACCOUNT, INVITATIONS, PLATFORM]
    : [ACCOUNT, PLATFORM];

  return (
    <>
      <PageHeader title="Settings" />
      <RouteTabs tabs={tabs} label="Settings" />
      {children}
    </>
  );
}
