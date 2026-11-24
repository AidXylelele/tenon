import {
  ACCOUNT_HREF,
  PEOPLE_HREF,
  PLATFORM_HREF,
} from "@/libs/routing/routes";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { RouteTabs } from "@/libs/ui/composites/route-tabs";

const ACCOUNT = { href: ACCOUNT_HREF, label: "Account" };
const PEOPLE = { href: PEOPLE_HREF, label: "People" };
const PLATFORM = { href: PLATFORM_HREF, label: "Platform" };

export function SettingsHeader({
  administrator,
}: {
  readonly administrator: boolean;
}) {
  const tabs = administrator
    ? [ACCOUNT, PEOPLE, PLATFORM]
    : [ACCOUNT, PLATFORM];

  return (
    <>
      <PageHeader title="Settings" />
      <RouteTabs tabs={tabs} label="Settings" />
    </>
  );
}
