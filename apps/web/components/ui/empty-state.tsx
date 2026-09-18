import React from "react";
import { LucideIcon, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  variant?: "default" | "sand" | "sage";
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border transition-all",
        variant === "default" && "bg-white/60 border-sand-200 shadow-soft",
        variant === "sand" && "bg-sand-50/70 border-sand-200/90 shadow-soft",
        variant === "sage" && "bg-sage-50/50 border-sage-200/80 shadow-soft",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sand-100 to-sand-200 border border-sand-300/80 flex items-center justify-center text-sage-700 mb-4 shadow-xs">
        <Icon className="w-7 h-7 stroke-[1.75]" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-sand-950 font-serif">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-sand-600 max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSecondaryAction}
              className="text-xs"
            >
              {secondaryActionLabel}
            </Button>
          )}

          {actionLabel && onAction && (
            <Button
              variant="default"
              size="sm"
              onClick={onAction}
              className="text-xs"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
