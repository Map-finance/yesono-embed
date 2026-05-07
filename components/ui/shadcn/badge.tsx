import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-(--accent) text-(--text-inverse) [a&]:hover:bg-(--accent-hover)",
        secondary:
          "border-transparent bg-(--bg-secondary) text-(--text-primary) [a&]:hover:bg-(--bg-hover)",
        destructive:
          "border-transparent bg-(--red)/10 text-(--red) [a&]:hover:bg-(--red)/20",
        outline:
          "border-(--border) text-(--text-primary) [a&]:hover:bg-(--bg-secondary)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
