import type { Metadata } from "next";
import { Overview } from "@/spaces/home/modules/overview";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <Overview />;
}
