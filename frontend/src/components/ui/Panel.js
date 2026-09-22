import { forwardRef } from "react";

import { cn } from "../../lib/cn";

const Panel = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-ds-lg border border-line bg-surface shadow-panel",
      className
    )}
    {...props}
  />
));

Panel.displayName = "Panel";

export default Panel;

