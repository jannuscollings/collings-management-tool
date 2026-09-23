import { forwardRef } from "react";

import { cn } from "../../lib/cn";

const controlClass =
  "w-full rounded-ds-xs border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({ label, hint, className, children }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10.5px] text-muted">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlClass, className)} {...props} />
));

Input.displayName = "Input";

export const Select = forwardRef(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlClass, "min-h-[40px]", className)} {...props} />
));

Select.displayName = "Select";

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlClass, "min-h-20 resize-y", className)}
    {...props}
  />
));

Textarea.displayName = "Textarea";

