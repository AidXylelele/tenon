import { cn } from "../tokens/cn";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusLook {
  readonly tone: Tone;
  readonly icon: LucideIcon;
  readonly label: string;
}

const TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

interface StatusProps {
  readonly look: StatusLook;
  readonly live?: boolean;
  readonly className?: string;
}

export function Status({ look, live = false, className }: StatusProps) {
  const Icon = look.icon;
  const iconClasses = cn("size-4 shrink-0", live && "animate-live");
  const classes = cn(
    "inline-flex items-center gap-1.5 text-body whitespace-nowrap",
    TEXT[look.tone],
    className,
  );

  return (
    <span className={classes}>
      <Icon className={iconClasses} aria-hidden />
      {look.label}
    </span>
  );
}
