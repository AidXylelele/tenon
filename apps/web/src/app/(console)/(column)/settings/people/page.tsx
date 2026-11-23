import type { Metadata } from "next";
import { Invitations } from "@/spaces/settings/modules/invitations";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return <Invitations />;
}
