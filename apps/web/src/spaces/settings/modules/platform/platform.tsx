import { hostProfile } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { PlatformPage } from "./platform-page";

export async function Platform() {
  const profile = await available(hostProfile());

  if (profile === UNAVAILABLE) return <Unavailable />;

  return <PlatformPage profile={profile} />;
}
