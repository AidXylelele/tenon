import { cva } from "class-variance-authority";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-sm text-body whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) ease-standard outline-none hover:text-foreground disabled:pointer-events-none disabled:text-faint data-[state=on]:bg-accent-soft data-[state=on]:font-semibold data-[state=on]:text-accent-text data-[state=on]:shadow-[inset_0_0_0_2px_var(--accent-text)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "bg-transparent",
      },
      size: {
        default:
          "h-[26px] min-w-[26px] px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-[22px] min-w-[22px] px-2 text-caption has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export { toggleVariants };
