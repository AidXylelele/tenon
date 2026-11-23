import {
  CalendarIcon,
  CornerDownRightIcon,
  KeyRoundIcon,
  type LucideIcon,
} from "lucide-react";
import type { ChoiceKind } from "./data-choices";

const ICONS: Readonly<Record<ChoiceKind, LucideIcon>> = {
  data: CornerDownRightIcon,
  time: CalendarIcon,
  secret: KeyRoundIcon,
};

export function ChoiceIcon({
  kind,
  className,
}: {
  readonly kind: ChoiceKind;
  readonly className: string;
}) {
  const Icon = ICONS[kind];

  return <Icon className={className} aria-hidden />;
}
