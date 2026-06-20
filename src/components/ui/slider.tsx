"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex w-full touch-none select-none items-center", className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
        <SliderPrimitive.Range className="absolute h-full bg-zinc-950 dark:bg-white" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-white bg-zinc-950 shadow-lg ring-offset-white transition focus:outline-none focus:ring-4 focus:ring-zinc-400/20 dark:bg-white" />
    </SliderPrimitive.Root>
  );
}
