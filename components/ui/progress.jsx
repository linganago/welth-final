"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../lib/utils";

/**
 * Progress bar component.
 *
 * Props:
 *   value             – 0-100
 *   indicatorClassName – extra classes applied to the filled indicator bar
 *                        (e.g. "bg-red-500", "bg-yellow-500", "bg-green-500")
 */
const Progress = React.forwardRef(
  ({ className, value, indicatorClassName, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full flex-1 transition-all bg-primary",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
