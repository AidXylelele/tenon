import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { Announcer } from "@/libs/ui/composites/announcer";
import { geistMono, geistSans } from "@/libs/ui/fonts";
import { chosenTheme } from "../../__shared_context/chosen-theme";
import { themeAttributeOf } from "../../__shared_context/theme";
import { ConsoleToaster } from "./console-toaster";

export async function RootFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const theme = await chosenTheme();
  const attribute = themeAttributeOf(theme);
  const fonts = `${geistSans.variable} ${geistMono.variable} h-full antialiased`;

  return (
    <html lang="en" data-theme={attribute} className={fonts}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={300}>
          <Announcer>{children}</Announcer>
          <ConsoleToaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
