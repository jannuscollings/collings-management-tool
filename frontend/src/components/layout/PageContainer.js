import { cn } from "../../lib/cn";

export default function PageContainer({ className, ...props }) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1420px] px-4 py-6 sm:px-6 shell:px-[30px] shell:py-[34px]", className)}
      {...props}
    />
  );
}

