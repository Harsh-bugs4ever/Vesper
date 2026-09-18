import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sage-100 text-sage-800 border border-sage-200/60",
        sage:
          "border border-sage-300/80 bg-sage-50 text-sage-800 font-semibold",
        gold:
          "border border-gold-300 bg-gold-50 text-gold-900 font-semibold shadow-xs",
        sand:
          "border border-sand-300 bg-sand-100 text-sand-800",
        ready:
          "border border-emerald-300 bg-emerald-50 text-emerald-800 font-medium",
        cleaning:
          "border border-amber-300 bg-amber-50 text-amber-800 font-medium",
        dirty:
          "border border-rose-300 bg-rose-50 text-rose-800 font-medium",
        outline:
          "border border-sand-300 text-sand-700 bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
