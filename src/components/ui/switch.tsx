"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-zinc-300 transition-colors data-[state=checked]:bg-zinc-950 dark:bg-zinc-700 dark:data-[state=checked]:bg-white",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg transition-transform data-[state=checked]:translate-x-5 dark:data-[state=checked]:bg-zinc-950" />
    </SwitchPrimitive.Root>
  );
}
