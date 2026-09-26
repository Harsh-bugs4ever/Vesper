import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The surface every Vesper section is built on.
 *
 * Deliberately flatter than `Card`: a hairline warm border and no shadow, so a page of
 * twelve panels reads as one calm sheet rather than twelve floating objects. `Card` is
 * still around for the older screens; new sections use this.
 */
const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { tone?: "default" | "muted" }
>(({ className, tone = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-sand-200/80",
      tone === "default" ? "bg-white" : "bg-sand-50/60",
      className
    )}
    {...props}
  />
));
Panel.displayName = "Panel";

/** Title row. Put filters or a "View all" link in `action`; it right-aligns. */
function PanelHeader({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  if (children) {
    return <div className={cn("px-5 pt-5", className)}>{children}</div>;
  }
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="font-serif text-lg font-semibold text-sand-950 leading-tight">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-sand-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export { Panel, PanelHeader, PanelBody };
