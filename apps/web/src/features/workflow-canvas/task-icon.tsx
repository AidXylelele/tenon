import { cn } from "@/libs/ui/tokens/cn";
import {
  BellRingIcon,
  BracesIcon,
  EarIcon,
  GitBranchIcon,
  GitForkIcon,
  GlobeIcon,
  HourglassIcon,
  LayersIcon,
  type LucideIcon,
  OctagonXIcon,
  RepeatIcon,
  ShieldIcon,
  SquareTerminalIcon,
} from "lucide-react";
import type { StepKind } from "@/operations/step-kinds";

const ICONS: Record<StepKind, LucideIcon> = {
  call: GlobeIcon,
  run: SquareTerminalIcon,
  set: BracesIcon,
  emit: BellRingIcon,
  listen: EarIcon,
  wait: HourglassIcon,
  switch: GitBranchIcon,
  for: RepeatIcon,
  fork: GitForkIcon,
  try: ShieldIcon,
  do: LayersIcon,
  raise: OctagonXIcon,
};

const TILE_SIZE = {
  md: "size-10 [&_svg]:size-5",
  sm: "size-9 [&_svg]:size-4",
} as const;

export function TaskTile({
  kind,
  size = "md",
}: {
  readonly kind: StepKind;
  readonly size?: keyof typeof TILE_SIZE;
}) {
  const Icon = ICONS[kind];
  const box = cn(
    "flex shrink-0 items-center justify-center rounded-xl bg-muted text-foreground",
    TILE_SIZE[size],
  );

  return (
    <span className={box}>
      <Icon aria-hidden />
    </span>
  );
}
