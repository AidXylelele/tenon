import type { Metadata } from "next";
import { SignIn } from "@/spaces/identity/modules/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  return <SignIn query={await searchParams} />;
}
