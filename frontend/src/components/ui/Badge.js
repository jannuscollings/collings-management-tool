import { cva } from "class-variance-authority";

import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-ds-pill px-2.5 py-1 text-[9.5px] font-extrabold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
        info: "bg-blue-50 text-info dark:bg-blue-950/50 dark:text-blue-200",
        warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
        success: "bg-emerald-50 text-positive dark:bg-emerald-950/50 dark:text-emerald-200",
        danger: "bg-red-50 text-critical dark:bg-red-950/50 dark:text-red-200",
        brand: "bg-brand-soft text-brand-strong dark:text-brand",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export default function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

