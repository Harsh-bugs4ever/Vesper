import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-sage-600 text-white shadow-soft hover:bg-sage-700 hover:shadow-card active:bg-sage-800",
        secondary:
          "bg-sand-100 text-sand-900 border border-sand-200 hover:bg-sand-200 hover:border-sand-300",
        gold:
          "bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 text-sand-950 font-semibold shadow-gold hover:from-gold-600 hover:to-gold-500 hover:shadow-elevated",
        outline:
          "border border-sage-300 bg-white text-sage-800 hover:bg-sage-50 hover:border-sage-400",
        ghost:
          "text-sage-800 hover:bg-sage-100/60 hover:text-sage-900",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-soft",
        link:
          "text-sage-700 underline-offset-4 hover:underline p-0 h-auto font-medium",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
