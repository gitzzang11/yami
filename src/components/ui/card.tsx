import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/66 dark:shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold tracking-tight", className)} {...props} />;
}
