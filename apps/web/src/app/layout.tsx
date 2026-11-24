import type { Metadata } from "next";
import { pageTitle, PRODUCT_NAME } from "@/libs/routing/page-title";
import { RootFrame } from "@/spaces/shell/modules/root-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: pageTitle("%s"), default: PRODUCT_NAME },
  description: "Build, run and watch workflows on the Open Workflow standard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <RootFrame>{children}</RootFrame>;
}
