"use client";

import { motion } from "framer-motion";
import { CalendarDays, CloudOff, RefreshCw, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatKoreanDate, scoreTone } from "@/lib/utils";
import { evaluateMealWithGemini } from "@/services/gemini";
import { scheduleDailyMealNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, LoadState, Meal, School } from "@/types";

type Props = {
  school: School;
  today?: Meal;
  tomorrow?: Meal;
  week: Meal[];
  review?: AiReview;
  state: LoadState;
  error: string;
  offline: boolean;
  onReload: () => void;
  onReview: (review: AiReview) => void;
};

export function HomeDashboard({
  school,
  today,
  tomorrow,
  week,
  review,
  state,
  error,
  offline,
  onReload,
  onReview,
}: Props) {
  const { settings, criteria } = useAppStore();
  const tone = scoreTone(review?.totalScore);

  async function evaluate() {
    if (!today) return;
    const result = await evaluateMealWithGemini(
      today,
      criteria,
      settings.geminiApiKey,
      settings.geminiModel,
      school.kind
    );
    onReview(result);
    if (settings.notificationsEnabled) {
      await scheduleDailyMealNotification(settings.notificationTime, today, result);
    }
  }

  return (
    <div className="space-y-5">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <CalendarDays className="h-4 w-4" />
            {formatKoreanDate(new Date())}
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{school.name}</h1>
        </div>
        <Button variant="secondary" size="icon" onClick={onReload} aria-label="급식 새로고침">
          <RefreshCw className="h-5 w-5" />
        </Button>
      </motion.header>

      {offline ? (
        <div className="flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
          <CloudOff className="h-4 w-4" />
          오프라인 캐시 급식을 표시 중입니다.
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.25),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,.22),transparent_28%)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              오늘 급식
            </CardTitle>
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black dark:bg-black/20">
              {today?.calories ?? "칼로리 정보 없음"}
            </span>
          </div>

          {state === "loading" ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-full bg-white/60 dark:bg-white/10" />
              ))}
            </div>
          ) : today ? (
            <motion.div layout className="flex flex-wrap gap-2">
              {today.menu.map((item) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-full bg-white/78 px-4 py-2 text-sm font-bold shadow-sm ring-1 ring-white/70 dark:bg-white/12 dark:ring-white/10"
                >
                  {item}
                </motion.span>
              ))}
            </motion.div>
          ) : (
            <p className="rounded-3xl bg-white/60 p-5 text-sm font-semibold text-zinc-500 dark:bg-white/10">
              {state === "error" ? error : "오늘 등록된 중식 정보가 없습니다."}
            </p>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">AI 급식 평가</p>
            <h2 className="text-2xl font-black">{review ? `${review.totalScore}점` : "평가 전"}</h2>
          </div>
          <div className={`grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br ${tone.className} text-4xl shadow-lg`}>
            {tone.emoji}
          </div>
        </div>
        <p className={`text-lg font-black ${tone.textClassName}`}>{review?.oneLine ?? "AI가 급식의 운명을 기다리고 있어요"}</p>
        {review ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{review.detail}</p>
            <div className="grid grid-cols-2 gap-2">
              {review.scores.map((score) => (
                <div key={score.name} className="rounded-2xl bg-zinc-100 p-3 dark:bg-white/10">
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{score.name}</div>
                  <div className="mt-1 text-lg font-black">
                    {score.score}/{score.max}
                  </div>
                </div>
              ))}
            </div>
            {review.customScores && review.customScores.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">나의 커스텀 기준 반영도</div>
                <div className="grid gap-2">
                  {review.customScores.map((score) => (
                    <div key={score.name} className="rounded-2xl bg-zinc-50/70 p-3.5 ring-1 ring-zinc-200/50 dark:bg-white/5 dark:ring-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-200">{score.name}</span>
                        <span className="text-sm font-black text-[var(--theme)]">{score.score} / {score.max}</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-5">{score.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <Button onClick={evaluate} disabled={!today || state === "loading"} className="w-full">
          <Sparkles className="h-5 w-5" />
          AI 평가하기
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>내일 급식</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {tomorrow?.menu.length ? tomorrow.menu.map((item) => (
              <span key={item} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold dark:bg-white/10">
                {item}
              </span>
            )) : <p className="text-sm text-zinc-500">내일 중식 정보가 없습니다.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle>영양 정보</CardTitle>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {today?.nutrition?.replace(/<br\/?>/gi, "\n") ?? "영양 정보가 없습니다."}
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>주간 급식</CardTitle>
        <div className="mt-4 space-y-3">
          {week.length ? week.map((meal) => (
            <div key={meal.id} className="rounded-3xl bg-white/60 p-4 ring-1 ring-zinc-200 dark:bg-white/10 dark:ring-white/10">
              <div className="mb-2 text-sm font-black">{meal.date.slice(4, 6)}월 {meal.date.slice(6)}일</div>
              <div className="flex flex-wrap gap-2">
                {meal.menu.slice(0, 7).map((item) => (
                  <span key={item} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-950/40">{item}</span>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-zinc-500">주간 급식 정보가 없습니다.</p>}
        </div>
      </Card>
    </div>
  );
}
