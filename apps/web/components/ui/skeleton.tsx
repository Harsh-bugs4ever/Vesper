import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-sand-200/60",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
