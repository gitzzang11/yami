import Link from "next/link";
import { ArrowLeft, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-app p-6 text-center">
      <div className="max-w-md space-y-4 rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Utensils className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white">페이지를 찾을 수 없습니다</h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="pt-2">
          <Button asChild className="w-full">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
