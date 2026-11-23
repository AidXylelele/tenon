import type { Metadata } from "next";
import { Webhooks } from "@/spaces/connections/modules/webhooks";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage({
  searchParams,
}: PageProps<"/webhooks">) {
  return <Webhooks query={await searchParams} />;
}
