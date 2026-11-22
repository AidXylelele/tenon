"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisIcon,
  RepeatIcon,
  ShieldIcon,
  SquareStackIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { useFlow } from "./context";
import type { StepEdit, StepPlace } from "./interfaces";
import { menuItemOf, plusItemOf, stepItemOf } from "./items";

type Block = Extract<StepEdit, { readonly kind: "wrapSteps" }>["block"];

const LABEL = "Step actions";

export function StepMenu({ place }: { readonly place: StepPlace }) {
  const { mode, onDeleting, itemProps } = useFlow();

  if (mode.kind !== "edit") return null;

  const { onEdit } = mode;
  const { step, list, index } = place;
  const menu = menuItemOf(step.id);
  const first = index === 0;
  const last = index === list.steps.length - 1;

  function move(by: number) {
    const to = index + by;
    onEdit({ kind: "moveStep", step: step.id, list: list.id, index: to });
  }

  function wrap(block: Block) {
    onEdit({ kind: "wrapSteps", steps: [step.id], block, name: null });
  }

  function remove() {
    const above = plusItemOf(list.id, index);
    const before = list.steps[index - 1];
    const after = list.steps[index + 1];
    const neighbours = [before, after].flatMap((each) =>
      each === undefined ? [] : [stepItemOf(each.id)],
    );
    onDeleting({ step: step.id, focus: [above, ...neighbours] });
    onEdit({ kind: "removeStep", step: step.id });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={LABEL}
          icon={EllipsisIcon}
          size="icon-xs"
          {...itemProps(menu)}
          className="text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem
          onSelect={() => {
            onEdit({ kind: "duplicateStep", step: step.id });
          }}
        >
          <CopyIcon aria-hidden />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={first}
          onSelect={() => {
            move(-1);
          }}
        >
          <ArrowUpIcon aria-hidden />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={last}
          onSelect={() => {
            move(1);
          }}
        >
          <ArrowDownIcon aria-hidden />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            wrap("try");
          }}
        >
          <ShieldIcon aria-hidden />
          Wrap in Try (retry if it fails)
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            wrap("for");
          }}
        >
          <RepeatIcon aria-hidden />
          Wrap in Repeat for each item
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            wrap("do");
          }}
        >
          <SquareStackIcon aria-hidden />
          Wrap in a group
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          <Trash2Icon aria-hidden />
          Delete step
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
