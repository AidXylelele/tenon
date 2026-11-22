import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/libs/ui/tokens/cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-body font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard select-none disabled:pointer-events-none disabled:text-faint aria-disabled:cursor-not-allowed aria-disabled:text-faint aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-accent-solid text-on-accent hover:bg-accent-solid-hover active:bg-accent-solid-hover disabled:bg-hover aria-disabled:bg-hover aria-disabled:hover:bg-hover",
        outline:
          "border-border-strong bg-surface text-foreground hover:bg-hover active:bg-selected aria-expanded:bg-hover aria-disabled:hover:bg-surface",
        secondary:
          "bg-hover text-foreground hover:bg-selected active:bg-selected aria-expanded:bg-selected aria-disabled:hover:bg-hover",
        ghost:
          "text-foreground hover:bg-hover active:bg-selected aria-expanded:bg-hover aria-disabled:hover:bg-transparent",
        destructive:
          "border-danger-border bg-danger-soft text-danger hover:border-danger active:border-danger aria-disabled:hover:border-danger-border",
        link: "text-accent-text underline-offset-4 hover:underline aria-disabled:hover:no-underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-sm px-2 text-caption has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
