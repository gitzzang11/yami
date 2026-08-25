"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CloudOff,
  Copy,
  Flame,
  RefreshCw,
  Share2,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ALLERGIES_MAP, formatKoreanDate, parseNutritionInfo, scoreTone } from "@/lib/utils";
import { evaluateMealWithGemini } from "@/services/gemini";
import { scheduleDailyMealNotification } from "@/services/notifications";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, LoadState, Meal, MealKind, School } from "@/types";

type Props = {
  school: School;
  mealKind: MealKind;
  onMealKindChange: (kind: MealKind) => void;
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

const MEAL_KIND_LABELS: Record<MealKind, string> = {
  breakfast: "조식",
  lunch: "중식",
  dinner: "석식",
};

export function HomeDashboard({
  school,
  mealKind,
  onMealKindChange,
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
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const tone = scoreTone(review?.totalScore);
  const userAllergies = settings.userAllergies ?? [];
  const nutrition = parseNutritionInfo(today?.nutrition, today?.calories);

  async function evaluate() {
    if (!today) return;
    setIsEvaluating(true);
    setEvalError(null);
    try {
      const result = await evaluateMealWithGemini(
        today,
        criteria,
        settings.geminiApiKey,
        settings.geminiModel,
        school.kind,
      );
      onReview(result);
      if (settings.notificationsEnabled) {
        await scheduleDailyMealNotification(settings.notificationTime, today, result);
      }
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "AI 평가 중 오류가 발생했습니다.");
    } finally {
      setIsEvaluating(false);
    }
  }

  function handleCopyShareText() {
    if (!today) return;
    const lines = [
      `🍱 [${school.name}] ${formatKoreanDate(new Date())} ${MEAL_KIND_LABELS[mealKind]}`,
      review ? `⭐ AI 점수: ${review.totalScore}점 (${tone.label}) ${tone.emoji}` : "",
      review ? `💬 "${review.oneLine}"` : "",
      "",
      `🍴 오늘 메뉴:`,
      today.menu.map((m) => `• ${m}`).join("\n"),
      today.calories ? `\n🔥 ${today.calories}` : "",
      "\n✨ 급식평론가 Yami에서 확인했어요!",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(lines).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function handleNativeShare() {
    if (!today) return;
    const shareText = `🍱 [${school.name}] ${formatKoreanDate(new Date())} ${MEAL_KIND_LABELS[mealKind]} - ${review ? `${review.totalScore}점! "${review.oneLine}"` : "오늘의 급식 메뉴를 확인해보세요!"}\n메뉴: ${today.menu.join(", ")}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${school.name} 오늘의 급식`,
          text: shareText,
        });
      } catch {
        handleCopyShareText();
      }
    } else {
      handleCopyShareText();
    }
  }

  return (
    <div className="space-y-5">
      {/* 상단 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
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

      {/* 조식 / 중식 / 석식 세그먼트 토글 */}
      <div className="flex rounded-full bg-zinc-200/70 p-1 dark:bg-white/10">
        {(["breakfast", "lunch", "dinner"] as MealKind[]).map((kind) => {
          const isActive = mealKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onMealKindChange(kind)}
              className={`flex-1 rounded-full py-2 text-xs font-black transition cursor-pointer relative ${
                isActive
                  ? "bg-white text-zinc-950 shadow-md dark:bg-zinc-900 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {MEAL_KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>

      {offline ? (
        <div className="flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
          <CloudOff className="h-4 w-4" />
          오프라인 캐시 급식을 표시 중입니다.
        </div>
      ) : null}

      {/* 오늘 급식 카드 */}
      <Card className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.25),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,.22),transparent_28%)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              오늘 {MEAL_KIND_LABELS[mealKind]}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-black dark:bg-black/20">
                <Flame className="h-3 w-3 text-orange-500" />
                {today?.calories ?? "칼로리 미등록"}
              </span>
            </div>
          </div>

          {state === "loading" ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-full bg-white/60 dark:bg-white/10" />
              ))}
            </div>
          ) : today ? (
            <motion.div layout className="flex flex-wrap gap-2">
              {today.menuItems && today.menuItems.length > 0
                ? today.menuItems.map((item) => {
                    const hasAllergyWarning =
                      userAllergies.length > 0 &&
                      item.allergies.some((a) => userAllergies.includes(a));
                    const matchedAllergies = item.allergies
                      .filter((a) => userAllergies.includes(a))
                      .map((a) => ALLERGIES_MAP[a] || `${a}번`);

                    return (
                      <motion.div
                        key={item.raw || item.name}
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-sm ring-1 ${
                          hasAllergyWarning
                            ? "bg-rose-50 text-rose-700 ring-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800"
                            : "bg-white/80 text-zinc-900 ring-white/70 dark:bg-white/12 dark:text-white dark:ring-white/10"
                        }`}
                      >
                        {hasAllergyWarning && (
                          <span
                            className="flex items-center text-xs text-rose-600 dark:text-rose-400"
                            title={`알레르기 주의: ${matchedAllergies.join(", ")}`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mr-0.5" />
                          </span>
                        )}
                        <span>{item.name}</span>
                        {item.allergies.length > 0 && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                            ({item.allergies.join(".")})
                          </span>
                        )}
                      </motion.div>
                    );
                  })
                : today.menu.map((item) => (
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
              {state === "error" ? error : `오늘 등록된 ${MEAL_KIND_LABELS[mealKind]} 정보가 없습니다.`}
            </p>
          )}
        </div>
      </Card>

      {/* AI 급식 평가 카드 */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">AI 급식 평가</p>
            <h2 className="text-2xl font-black">{review ? `${review.totalScore}점` : "평가 전"}</h2>
          </div>
          <div
            className={`grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br ${tone.className} text-4xl shadow-lg`}
          >
            {tone.emoji}
          </div>
        </div>

        <p className={`text-lg font-black ${tone.textClassName}`}>
          {review?.oneLine ?? "AI가 급식의 운명을 기다리고 있어요"}
        </p>

        {/* AI 평가 중 애니메이션 */}
        {isEvaluating && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-zinc-100/80 p-4 dark:bg-white/10"
          >
            <Sparkles className="h-5 w-5 animate-spin text-[var(--theme)]" />
            <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200 animate-pulse">
              AI 셰프가 식단 구성을 시식 및 평가하는 중입니다...
            </div>
          </motion.div>
        )}

        {evalError && (
          <p className="rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            {evalError}
          </p>
        )}

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
                <div className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  나의 커스텀 기준 반영도
                </div>
                <div className="grid gap-2">
                  {review.customScores.map((score) => (
                    <div
                      key={score.name}
                      className="rounded-2xl bg-zinc-50/70 p-3.5 ring-1 ring-zinc-200/50 dark:bg-white/5 dark:ring-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-200">{score.name}</span>
                        <span className="text-sm font-black text-[var(--theme)]">
                          {score.score} / {score.max}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-5">{score.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            onClick={evaluate}
            disabled={!today || state === "loading" || isEvaluating}
            className="flex-1"
          >
            <Sparkles className="h-5 w-5" />
            {isEvaluating ? "평가 진행 중..." : review ? "AI 다시 평가하기" : "AI 평가하기"}
          </Button>

          {today && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsShareModalOpen(true)}
              aria-label="급식 성적표 공유"
              title="성적표 공유하기"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </Card>

      {/* 내일 급식 및 영양 시각화 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>내일 {MEAL_KIND_LABELS[mealKind]}</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {tomorrow?.menu.length ? (
              tomorrow.menu.map((item) => (
                <span key={item} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold dark:bg-white/10">
                  {item}
                </span>
              ))
            ) : (
              <p className="text-sm text-zinc-500">내일 {MEAL_KIND_LABELS[mealKind]} 정보가 없습니다.</p>
            )}
          </div>
        </Card>

        {/* 영양 정보 시각화 카드 */}
        <Card className="space-y-3">
          <CardTitle>영양 성분 분석</CardTitle>
          {today?.nutrition ? (
            <div className="space-y-2.5 pt-1">
              {/* 탄단지 매크로 시각화 */}
              {(nutrition.carbs !== undefined || nutrition.protein !== undefined || nutrition.fat !== undefined) && (
                <div className="space-y-2 rounded-2xl bg-zinc-50 p-3.5 dark:bg-white/5">
                  <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">주요 영양소 밸런스</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                      <div className="text-[11px] font-semibold">탄수화물</div>
                      <div className="text-sm font-black">{nutrition.carbs ?? "-"}g</div>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                      <div className="text-[11px] font-semibold">단백질</div>
                      <div className="text-sm font-black">{nutrition.protein ?? "-"}g</div>
                    </div>
                    <div className="rounded-xl bg-rose-500/10 p-2 text-rose-700 dark:text-rose-300">
                      <div className="text-[11px] font-semibold">지방</div>
                      <div className="text-sm font-black">{nutrition.fat ?? "-"}g</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 영양성분 세부 리스트 */}
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400 pr-1">
                {nutrition.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between border-b border-zinc-100 py-0.5 dark:border-zinc-800">
                    <span className="font-medium">{it.label}</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{it.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">등록된 영양 정보가 없습니다.</p>
          )}
        </Card>
      </div>

      {/* 주간 급식 */}
      <Card>
        <CardTitle>주간 {MEAL_KIND_LABELS[mealKind]}</CardTitle>
        <div className="mt-4 space-y-3">
          {week.length ? (
            week.map((meal) => (
              <div
                key={meal.id}
                className="rounded-3xl bg-white/60 p-4 ring-1 ring-zinc-200 dark:bg-white/10 dark:ring-white/10"
              >
                <div className="mb-2 text-sm font-black">
                  {meal.date.slice(4, 6)}월 {meal.date.slice(6)}일
                </div>
                <div className="flex flex-wrap gap-2">
                  {meal.menu.slice(0, 7).map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-950/40"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">주간 급식 정보가 없습니다.</p>
          )}
        </div>
      </Card>

      {/* SNS 성적표 공유 모달 */}
      <AnimatePresence>
        {isShareModalOpen && today && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Meal Scorecard</span>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white">급식 성적표 공유</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 공유용 카드 프리뷰 */}
              <div className="rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  <span>{school.name}</span>
                  <span>{formatKoreanDate(new Date())}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-bold text-zinc-400">{MEAL_KIND_LABELS[mealKind]} AI 점수</span>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">
                      {review ? `${review.totalScore}점` : "평가 전"}
                    </div>
                  </div>
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${tone.className} text-3xl shadow-md`}>
                    {tone.emoji}
                  </div>
                </div>

                {review && (
                  <p className={`text-sm font-black ${tone.textClassName}`}>
                    &ldquo;{review.oneLine}&rdquo;
                  </p>
                )}

                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-zinc-400 mb-1.5">오늘의 식단</div>
                  <div className="flex flex-wrap gap-1.5">
                    {today.menu.map((m) => (
                      <span key={m} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="space-y-2">
                <Button onClick={handleNativeShare} className="w-full">
                  <Share2 className="h-4 w-4" />
                  SNS / 메신저로 공유
                </Button>
                <Button variant="secondary" onClick={handleCopyShareText} className="w-full">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "클립보드에 복사됨!" : "텍스트 복사하기"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
