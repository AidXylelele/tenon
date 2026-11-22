import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleCheckIcon, CirclePlayIcon, CircleXIcon } from "lucide-react";
import { Status, type StatusLook } from "../composites/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

interface Run {
  readonly id: string;
  readonly workflow: string;
  readonly look: StatusLook;
  readonly started: string;
  readonly duration: string;
  readonly selected: boolean;
}

const RUNS: readonly Run[] = [
  {
    id: "r-1042",
    workflow: "sales/order-router",
    look: { tone: "info", icon: CirclePlayIcon, label: "Running" },
    started: "09:00",
    duration: "12 s",
    selected: false,
  },
  {
    id: "r-1041",
    workflow: "data/daily-digest",
    look: { tone: "success", icon: CircleCheckIcon, label: "Succeeded" },
    started: "08:30",
    duration: "4 s",
    selected: true,
  },
  {
    id: "r-1040",
    workflow: "data/score-lead",
    look: { tone: "danger", icon: CircleXIcon, label: "Failed" },
    started: "08:12",
    duration: "1 s",
    selected: false,
  },
];

function RunTable() {
  return (
    <div className="max-w-3xl overflow-hidden rounded-lg border m-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Workflow</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {RUNS.map((run) => {
            const state = run.selected ? "selected" : undefined;
            return (
              <TableRow key={run.id} data-state={state}>
                <TableCell>
                  <Status look={run.look} />
                </TableCell>
                <TableCell className="font-mono text-code">
                  {run.workflow}
                </TableCell>
                <TableCell>{run.started}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {run.duration}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Table",
  component: RunTable,
} satisfies Meta<typeof RunTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Density: Story = {};
