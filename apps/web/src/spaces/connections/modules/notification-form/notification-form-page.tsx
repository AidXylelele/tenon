import { PageHeader } from "@/libs/ui/composites/page-header";
import type { SubscriptionEditorProps } from "./interfaces";
import { SubscriptionEditor } from "./subscription-editor";

export function NotificationFormPage({
  secretNames,
  presets,
}: SubscriptionEditorProps) {
  return (
    <>
      <PageHeader
        title="New notification"
        description="Tell another app when something happens to your runs."
      />
      <SubscriptionEditor secretNames={secretNames} presets={presets} />
    </>
  );
}
