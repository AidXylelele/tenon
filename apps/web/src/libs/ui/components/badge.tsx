import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/libs/ui/tokens/cn";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 text-caption whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-accent-border bg-accent-soft text-accent-text [a]:hover:bg-accent-soft-hover",
        secondary:
          "border-border bg-surface text-muted-foreground [a]:hover:bg-hover",
        destructive:
          "border-danger-border bg-danger-soft text-danger-strong [a]:hover:border-danger",
        outline:
          "border-border bg-transparent text-foreground [a]:hover:bg-hover",
        ghost: "border-transparent text-muted-foreground hover:bg-hover",
        link: "border-transparent text-accent-text underline-offset-4 hover:underline",
        success:
          "border-success-border bg-success-soft text-success-strong [a]:hover:border-success",
        warning:
          "border-warning-border bg-warning-soft text-warning-strong [a]:hover:border-warning",
        info: "border-info-border bg-info-soft text-info-strong [a]:hover:border-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
