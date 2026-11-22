import type { Metadata } from "next";
import { TestEvent } from "@/spaces/connections/modules/test-event";

export const metadata: Metadata = { title: "Test event" };

export default function TestEventPage() {
  return <TestEvent />;
}
