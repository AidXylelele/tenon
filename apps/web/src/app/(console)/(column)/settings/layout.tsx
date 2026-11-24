import { SettingsFrame } from "@/spaces/settings/modules/settings-frame";

export default function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
