import type { Metadata } from "next";
import {
  VersionDocument,
  versionMetadata,
} from "@/spaces/workflows/modules/version-document";

export async function generateMetadata({
  params,
}: PageProps<"/workflows/[namespace]/[name]/versions/[version]">): Promise<Metadata> {
  return versionMetadata(await params);
}

export default async function VersionPage({
  params,
}: PageProps<"/workflows/[namespace]/[name]/versions/[version]">) {
  return <VersionDocument params={await params} />;
}
