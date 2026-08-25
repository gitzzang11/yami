"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Runtime Error:", error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center bg-app p-6 text-center">
      <div className="max-w-md space-y-4 rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white">문제가 발생했습니다</h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          일시적인 오류가 발생했습니다. 아래 버튼을 눌러 다시 시도하거나 앱을 새로고침해 주세요.
        </p>
        {error.message && (
          <p className="rounded-xl bg-zinc-100 p-3 text-xs font-mono text-zinc-500 dark:bg-white/5 dark:text-zinc-400 break-all">
            {error.message}
          </p>
        )}
        <div className="pt-2">
          <Button onClick={() => reset()} className="w-full">
            <RefreshCw className="h-4 w-4" />
            다시 시도하기
          </Button>
        </div>
      </div>
    </div>
  );
}
