import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { SettingsHeader } from "../../__shared_context/settings-header";

export async function SettingsFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const administrator = session?.capabilities.administrator === true;

  return (
    <>
      <SettingsHeader administrator={administrator} />
      {children}
    </>
  );
}
