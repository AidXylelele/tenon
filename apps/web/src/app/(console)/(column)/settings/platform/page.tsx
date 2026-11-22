import type { Metadata } from "next";
import { Platform } from "@/spaces/settings/modules/platform";

export const metadata: Metadata = { title: "Platform" };

export default function PlatformPage() {
  return <Platform />;
}
