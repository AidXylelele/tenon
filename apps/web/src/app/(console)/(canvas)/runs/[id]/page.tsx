import type { Metadata } from "next";
import { RunDetail } from "@/spaces/runs/modules/run-detail";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({
  params,
  searchParams,
}: PageProps<"/runs/[id]">) {
  return <RunDetail params={await params} query={await searchParams} />;
}
