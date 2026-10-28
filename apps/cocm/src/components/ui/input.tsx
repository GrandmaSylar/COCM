import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-11 lg:h-9 w-full min-w-0 rounded-md border border-transparent bg-muted px-3 py-1 text-base transition-colors duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary/60 focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20",
        "aria-invalid:ring-destructive aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
