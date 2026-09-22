import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-ds-sm border px-4 text-[12.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-white shadow-[0_5px_14px_rgba(45,200,219,0.22)] hover:bg-brand-strong",
        secondary: "border-line bg-surface text-copy hover:border-muted/50 hover:bg-canvas",
        dark: "border-navy bg-navy text-white hover:bg-navy/90",
        danger: "border-line bg-surface text-critical hover:border-critical/30 hover:bg-critical/5",
        ghost: "border-transparent bg-transparent text-brand-strong hover:bg-brand-soft",
      },
      size: {
        default: "px-4",
        icon: "w-[38px] px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

const Button = forwardRef(
  ({ asChild = false, className, variant, size, type, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : type || "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };

