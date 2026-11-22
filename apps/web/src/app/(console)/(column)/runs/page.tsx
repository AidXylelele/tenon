import type { Metadata } from "next";
import { RunList } from "@/spaces/runs/modules/run-list";

export const metadata: Metadata = { title: "Runs" };

export default async function RunsPage({ searchParams }: PageProps<"/runs">) {
  return <RunList query={await searchParams} />;
}
