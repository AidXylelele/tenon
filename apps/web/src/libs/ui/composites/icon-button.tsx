"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";

type IconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children"
> & {
  readonly label: string;
  readonly icon: LucideIcon;
};

export function IconButton({
  label,
  icon: Icon,
  variant = "ghost",
  size = "icon",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
