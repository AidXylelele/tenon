import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PageBody } from "@/libs/ui/composites/page-body";
import {
  ORDER_ROUTER,
  ROUTER_STRUCTURE,
  ROUTER_VERSIONS,
} from "../../__shared_context/workflows.test-support";
import { VersionPage } from "./version-page";

const YAML = `document:
  dsl: 1.0.0
  namespace: sales
  name: order-router
  version: 1.2.0
do:
  - route:
      switch:
        - electronic:
            when: \${ .orderType == "electronic" }
            then: ship
`;

const PAGE = "/workflows/sales/order-router/versions/1.2.0";

const meta = {
  title: "Spaces/Workflows/Version",
  component: VersionPage,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: PAGE } },
  },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={300}>
        <PageBody>
          <Story />
        </PageBody>
      </TooltipProvider>
    ),
  ],
  args: {
    workflow: ORDER_ROUTER,
    version: "1.2.0",
    versions: ROUTER_VERSIONS,
    structure: ROUTER_STRUCTURE,
    file: {
      text: YAML,
      kind: "YAML",
    },
    download: `${PAGE}/source`,
    view: "flow",
    hrefs: { flow: PAGE, code: `${PAGE}?view=code` },
    author: true,
    operator: true,
  },
} satisfies Meta<typeof VersionPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Flow: Story = {};

export const Code: Story = {
  args: { view: "code" },
};

export const AnEarlierVersion: Story = {
  args: { version: "1.1.0" },
};

export const ForAViewer: Story = {
  args: { author: false, operator: false },
};
