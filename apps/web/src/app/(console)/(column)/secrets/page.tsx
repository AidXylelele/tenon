import type { Metadata } from "next";
import { Secrets } from "@/spaces/secrets/modules/secrets";

export const metadata: Metadata = { title: "Secrets" };

export default async function SecretsPage({
  searchParams,
}: PageProps<"/secrets">) {
  return <Secrets query={await searchParams} />;
}
