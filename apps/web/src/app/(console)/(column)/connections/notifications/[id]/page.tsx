import type { Metadata } from "next";
import { NotificationDetail } from "@/spaces/connections/modules/notification-detail";

export const metadata: Metadata = { title: "Notification" };

export default async function NotificationPage({
  params,
}: PageProps<"/connections/notifications/[id]">) {
  return <NotificationDetail params={await params} />;
}
