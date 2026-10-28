"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-success data-[state=unchecked]:bg-fill-strong focus-visible:ring-ring/40 inline-flex h-[31px] w-[51px] lg:h-[26px] lg:w-[44px] shrink-0 items-center rounded-full border-0 p-[2px] transition-colors duration-200 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[27px] lg:size-[22px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] ring-0 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=checked]:translate-x-[20px] lg:data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
