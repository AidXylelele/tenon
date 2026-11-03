import {
  BellRingIcon,
  BracesIcon,
  CodeIcon,
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
  WaypointsIcon,
  WrenchIcon,
} from 'lucide-react';
import type { TaskKind } from '../document/tasks';

const ICONS: Record<TaskKind, LucideIcon> = {
  http: GlobeIcon,
  set: BracesIcon,
  wait: HourglassIcon,
  emit: BellRingIcon,
  listen: EarIcon,
  raise: OctagonXIcon,
  switch: GitBranchIcon,
  for: RepeatIcon,
  fork: GitForkIcon,
  try: ShieldIcon,
  do: LayersIcon,
  'run-workflow': WaypointsIcon,
  'run-script': CodeIcon,
  'run-shell': SquareTerminalIcon,
  advanced: WrenchIcon,
};

export function TaskIcon({
  kind,
  className,
}: {
  readonly kind: TaskKind;
  readonly className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={className} aria-hidden />;
}
