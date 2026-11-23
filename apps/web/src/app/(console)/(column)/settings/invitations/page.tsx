import type { Metadata } from "next";
import { People } from "@/spaces/settings/modules/people";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return <People />;
}
