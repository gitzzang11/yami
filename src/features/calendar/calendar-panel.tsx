"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { AlertTriangle, BookOpen, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Sparkles, Star, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { db } from "@/db/app-db";
import { formatKoreanDate, parseNutritionInfo, scoreTone } from "@/lib/utils";
import { USER_REACTION_CONFIG } from "@/services/feedback";
import { CRITIC_PERSONAS, evaluateMealWithGemini } from "@/services/gemini";
import { getMealsByRange, getSchoolSchedulesByRange } from "@/services/neis";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, Meal, MealKind, ScheduleEventType, SchoolScheduleEvent, UserMealFeedback } from "@/types";

const MEAL_KIND_LABELS: Record<MealKind, string> = {
  breakfast: "조식",
  lunch: "중식",
  dinner: "석식",
};

export const EVENT_TYPE_CONFIG: Record<
  ScheduleEventType,
  { label: string; icon: string; badgeClass: string; dotClass: string }
> = {
  exam: {
    label: "시험/평가",
    icon: "📝",
    badgeClass: "bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-950/60 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
  vacation: {
    label: "방학/개학",
    icon: "🏖️",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  holiday: {
    label: "휴업/공휴일",
    icon: "🎈",
    badgeClass: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  festival: {
    label: "행사/축제",
    icon: "🎪",
    badgeClass: "bg-indigo-100 text-indigo-800 ring-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
  },
  general: {
    label: "일반학사",
    icon: "📌",
    badgeClass: "bg-zinc-100 text-zinc-800 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300",
    dotClass: "bg-zinc-400",
  },
};

export function CalendarPanel() {
  const { settings, criteria } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [calendarKind, setCalendarKind] = useState<MealKind>(settings.preferredMealKind ?? "lunch");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [schedules, setSchedules] = useState<SchoolScheduleEvent[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserMealFeedback[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);

  const userAllergies = settings.userAllergies ?? [];
  const favoriteKeywords = settings.favoriteKeywords ?? [];

  // 급식, AI 평가, 학사일정 및 내 체감 평가 데이터 동시 가져오기
  const loadMonthData = useCallback(async (month: Date, kind: MealKind) => {
    if (!settings.selectedSchool) return;
    setIsLoading(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const startStr = format(start, "yyyyMMdd");
      const endStr = format(end, "yyyyMMdd");

      const [fetchedMeals, fetchedReviews, fetchedSchedules, fetchedFeedbacks] = await Promise.all([
        getMealsByRange(settings.selectedSchool, start, end, settings.neisApiKey, kind),
        db.reviews
          .where("schoolCode")
          .equals(settings.selectedSchool.schoolCode)
          .filter((r) => r.date >= startStr && r.date <= endStr && (!r.mealKind || r.mealKind === kind))
          .sortBy("createdAt"),
        getSchoolSchedulesByRange(settings.selectedSchool, start, end, settings.neisApiKey),
        db.userFeedbacks
          .where("schoolCode")
          .equals(settings.selectedSchool.schoolCode)
          .filter((f) => f.date >= startStr && f.date <= endStr && (!f.mealKind || f.mealKind === kind))
          .toArray(),
      ]);

      setMeals(fetchedMeals);
      setReviews(fetchedReviews);
      setSchedules(fetchedSchedules);
      setFeedbacks(fetchedFeedbacks);
    } catch (error) {
      console.error("캘린더 데이터를 불러오는 중 오류가 발생했습니다.", error);
    } finally {
      setIsLoading(false);
    }
  }, [settings.selectedSchool, settings.neisApiKey]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadMonthData(currentMonth, calendarKind);
    }, 0);
    return () => window.clearTimeout(task);
  }, [currentMonth, calendarKind, loadMonthData]);

  // 달력 날짜 연산
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // 매핑용 사전 빌드
  const mealMap = new Map<string, Meal>();
  meals.forEach((m) => mealMap.set(m.date, m));

  const reviewMap = new Map<string, AiReview>();
  reviews.forEach((r) => reviewMap.set(r.date, r));

  const scheduleMap = new Map<string, SchoolScheduleEvent[]>();
  schedules.forEach((s) => {
    const list = scheduleMap.get(s.date) || [];
    list.push(s);
    scheduleMap.set(s.date, list);
  });

  const feedbackMap = new Map<string, UserMealFeedback>();
  feedbacks.forEach((f) => feedbackMap.set(f.date, f));

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // 선택한 날짜에 해당하는 정보
  const selectedDateStr = format(selectedDate, "yyyyMMdd");
  const selectedMeal = mealMap.get(selectedDateStr);
  const selectedReview = reviewMap.get(selectedDateStr);
  const selectedSchedules = scheduleMap.get(selectedDateStr) ?? [];
  const selectedFeedback = feedbackMap.get(selectedDateStr);
  const selectedTone = scoreTone(selectedReview?.totalScore);
  const selectedNutrition = parseNutritionInfo(selectedMeal?.nutrition, selectedMeal?.calories);

  // 실시간 AI 평가 트리거
  const handleEvaluate = () => {
    if (!selectedMeal) return;
    startTransition(async () => {
      try {
        await evaluateMealWithGemini(
          selectedMeal,
          criteria,
          settings.geminiApiKey,
          settings.geminiModel,
          settings.selectedSchool?.kind,
          settings.criticPersona ?? "student",
        );
        // 캐시 데이터 새로 불러오기
        await loadMonthData(currentMonth, calendarKind);
      } catch (error) {
        alert(error instanceof Error ? error.message : "평가에 실패했습니다.");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 캘린더 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-black tracking-tight">
            {format(currentMonth, "yyyy년 M월")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={handlePrevMonth} aria-label="이전 달">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="secondary" size="icon" onClick={handleNextMonth} aria-label="다음 달">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </motion.header>

      {/* 조식 / 중식 / 석식 토글 */}
      <div className="flex rounded-full bg-zinc-200/70 p-1 dark:bg-white/10">
        {(["breakfast", "lunch", "dinner"] as MealKind[]).map((kind) => {
          const isActive = calendarKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setCalendarKind(kind)}
              className={`flex-1 rounded-full py-1.5 text-xs font-black transition cursor-pointer relative ${
                isActive
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {MEAL_KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>

      {/* 캘린더 그리드 */}
      <Card className="p-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* 일자 셀 */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = format(day, "yyyyMMdd");
            const hasMeal = mealMap.has(dateStr);
            const mealForDay = mealMap.get(dateStr);
            const review = reviewMap.get(dateStr);
            const daySchedules = scheduleMap.get(dateStr) ?? [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayTone = scoreTone(review?.totalScore);

            const hasFavorite =
              favoriteKeywords.length > 0 &&
              mealForDay?.menu.some((m) =>
                favoriteKeywords.some((k) => m.toLowerCase().includes(k.toLowerCase())),
              );

            const primarySchedule = daySchedules[0];
            const primaryScheduleConfig = primarySchedule ? EVENT_TYPE_CONFIG[primarySchedule.eventType] : null;

            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`relative flex flex-col items-center justify-between aspect-square p-1 rounded-2xl transition-all ${
                  isCurrentMonth
                    ? "text-zinc-950 dark:text-white"
                    : "text-zinc-300 dark:text-zinc-700"
                } ${
                  isSelected
                    ? "ring-2 ring-[var(--theme)] bg-white/40 dark:bg-white/5"
                    : "hover:bg-zinc-100 dark:hover:bg-white/5"
                }`}
              >
                {/* 학사 일정 아이콘 표시 (셀 좌측 상단) */}
                {primarySchedule && (
                  <span
                    className="absolute top-0.5 left-1 text-[9px] leading-none"
                    title={`${primarySchedule.eventName}${primarySchedule.gradeTarget ? ` (${primarySchedule.gradeTarget})` : ""}`}
                  >
                    {primaryScheduleConfig?.icon}
                  </span>
                )}

                {/* 최애 메뉴 표시 (셀 우측 상단) */}
                {hasFavorite && (
                  <span
                    className="absolute top-0.5 right-1 text-[9px] leading-none"
                    title="최애 메뉴 출몰!"
                  >
                    ⭐
                  </span>
                )}

                {/* 날짜 표시 */}
                <span
                  className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-[var(--theme)] text-white" : ""
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* 데이터 상태 표시 */}
                <div className="w-full flex justify-center mb-0.5">
                  {isLoading ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse" />
                  ) : review ? (
                    // AI 평가가 있는 경우 점수에 부합하는 이모지 표시
                    <span className="text-sm leading-none" title={`${review.totalScore}점`}>
                      {dayTone.emoji}
                    </span>
                  ) : hasMeal ? (
                    // 급식은 있고 AI 평가는 아직 안 된 경우 밥그릇 아이콘 표시
                    <span className="text-xs text-zinc-400 dark:text-zinc-500" title="평가 대기">
                      🍱
                    </span>
                  ) : primarySchedule ? (
                    // 급식이 없지만 학사 일정이 있는 날
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${primaryScheduleConfig?.dotClass || "bg-zinc-400"}`}
                      title={primarySchedule.eventName}
                    />
                  ) : (
                    // 급식/일정 모두 없는 날
                    <div className="h-3" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 선택 날짜 상세 정보 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDateStr}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-black">
              {formatKoreanDate(selectedDate)} ({MEAL_KIND_LABELS[calendarKind]})
            </h2>
            {selectedMeal && (
              <button
                onClick={() => setIsNutritionOpen(true)}
                className="text-xs font-bold rounded-full bg-zinc-100 px-3 py-1 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="영양 정보 보기"
              >
                <span>{selectedMeal.calories ?? "칼로리 정보 없음"}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">🔍</span>
              </button>
            )}
          </div>

          {/* 오늘의 학사 일정 카드 (일정이 있을 경우) */}
          {selectedSchedules.length > 0 && (
            <Card className="space-y-3 bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border-indigo-200/60 dark:from-indigo-950/20 dark:to-purple-950/20 dark:border-indigo-800/40">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-indigo-950 dark:text-indigo-200">
                <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                오늘의 학사 일정 ({selectedSchedules.length}건)
              </CardTitle>
              <div className="space-y-2">
                {selectedSchedules.map((schedule) => {
                  const config = EVENT_TYPE_CONFIG[schedule.eventType];
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-start justify-between gap-2 rounded-2xl bg-white/90 p-3 shadow-xs ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${config.badgeClass}`}
                          >
                            <span>{config.icon}</span>
                            <span>{config.label}</span>
                          </span>
                          <span className="text-sm font-black text-zinc-900 dark:text-white">
                            {schedule.eventName}
                          </span>
                        </div>
                        {schedule.eventContent && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {schedule.eventContent}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {schedule.gradeTarget && (
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                            {schedule.gradeTarget}
                          </span>
                        )}
                        {schedule.dayType && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            {schedule.dayType}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {selectedMeal ? (
            <div className="space-y-4">
              {/* 급식 식단 카드 */}
              <Card className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.1),transparent_30%)] p-4">
                <CardTitle className="flex items-center gap-2 mb-3 text-sm">
                  <Utensils className="h-4 w-4" />
                  급식 식단
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {selectedMeal.menuItems && selectedMeal.menuItems.length > 0
                    ? selectedMeal.menuItems.map((item) => {
                        const hasAllergy =
                          userAllergies.length > 0 &&
                          item.allergies.some((a) => userAllergies.includes(a));
                        const isFavorite = favoriteKeywords.some((k) =>
                          item.name.toLowerCase().includes(k.toLowerCase()),
                        );
                        return (
                          <span
                            key={item.raw || item.name}
                            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                              hasAllergy
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-800"
                                : isFavorite
                                  ? "bg-amber-50/90 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-700"
                                  : "bg-white/70 text-zinc-900 dark:bg-white/10 dark:text-white"
                            }`}
                          >
                            {hasAllergy ? (
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                            ) : isFavorite ? (
                              <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                            ) : null}
                            <span>{item.name}</span>
                            {item.allergies.length > 0 && (
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({item.allergies.join(".")})
                              </span>
                            )}
                          </span>
                        );
                      })
                    : selectedMeal.menu.map((item) => {
                        const isFavorite = favoriteKeywords.some((k) =>
                          item.toLowerCase().includes(k.toLowerCase()),
                        );
                        return (
                          <span
                            key={item}
                            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                              isFavorite
                                ? "bg-amber-50/90 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-700"
                                : "bg-white/70 text-zinc-900 dark:bg-white/10 dark:text-white"
                            }`}
                          >
                            {isFavorite && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />}
                            <span>{item}</span>
                          </span>
                        );
                      })}
                </div>
              </Card>

              {/* AI 비평 평론 카드 */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        AI 급식 평가
                      </p>
                      {selectedReview?.personaName && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                          {CRITIC_PERSONAS[selectedReview.persona || "student"]?.icon || "🎓"} {selectedReview.personaName}
                        </span>
                      )}
                      {selectedFeedback && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30">
                          <span>{USER_REACTION_CONFIG[selectedFeedback.reaction]?.emoji}</span>
                          <span>내 체감 {selectedFeedback.score}점</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black">
                      {selectedReview ? `${selectedReview.totalScore}점` : "평가 전"}
                    </h3>
                  </div>
                  <div
                    className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${selectedTone.className} text-2xl shadow-md`}
                  >
                    {selectedTone.emoji}
                  </div>
                </div>

                <p className={`text-base font-black ${selectedTone.textClassName}`}>
                  {selectedReview?.oneLine ?? "이 급식을 아직 AI 비평가가 음미하지 않았습니다."}
                </p>

                {selectedReview && (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {selectedReview.detail}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedReview.scores.map((score) => (
                        <div key={score.name} className="rounded-xl bg-zinc-50 p-2.5 dark:bg-white/5">
                          <div className="text-2xs font-semibold text-zinc-500 dark:text-zinc-400">
                            {score.name}
                          </div>
                          <div className="mt-0.5 text-sm font-black">
                            {score.score}/{score.max}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedReview.customScores && selectedReview.customScores.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="text-2xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">나의 커스텀 기준 반영도</div>
                        <div className="grid gap-2">
                          {selectedReview.customScores.map((score) => (
                            <div key={score.name} className="rounded-xl bg-zinc-50/70 p-3 ring-1 ring-zinc-200/50 dark:bg-white/5 dark:ring-white/5 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">{score.name}</span>
                                <span className="text-xs font-black text-[var(--theme)]">{score.score} / {score.max}</span>
                              </div>
                              <p className="text-3xs text-zinc-500 dark:text-zinc-400 leading-4">{score.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleEvaluate}
                  disabled={isPending}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  {isPending ? "평가 중..." : "AI 평가하기"}
                </Button>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center text-sm font-semibold text-zinc-500 dark:bg-white/5">
              이 날은 {MEAL_KIND_LABELS[calendarKind]} 정보가 등록되지 않은 날입니다.
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 이달의 주요 학사일정 타임라인 요약 카드 */}
      {schedules.length > 0 && (
        <Card className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-sm font-black">
            <CalendarIcon className="h-4 w-4 text-[var(--theme)]" />
            {format(currentMonth, "M월")} 전체 학사일정 ({schedules.length}건)
          </CardTitle>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-56 overflow-y-auto">
            {schedules.map((schedule) => {
              const config = EVENT_TYPE_CONFIG[schedule.eventType];
              const dayNum = Number(schedule.date.slice(6, 8));
              return (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => {
                    const y = Number(schedule.date.slice(0, 4));
                    const m = Number(schedule.date.slice(4, 6)) - 1;
                    const d = Number(schedule.date.slice(6, 8));
                    setSelectedDate(new Date(y, m, d));
                  }}
                  className="w-full flex items-center justify-between py-2 px-1 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-xl transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-9 text-xs font-black text-zinc-400 dark:text-zinc-500">
                      {dayNum}일
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${config.badgeClass}`}
                    >
                      {config.icon} {config.label}
                    </span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {schedule.eventName}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-zinc-400 shrink-0 ml-2">
                    {schedule.gradeTarget || ""}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 영양 정보 팝업 모달 */}
      <AnimatePresence>
        {isNutritionOpen && selectedMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 배경 오버레이 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNutritionOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* 팝업 모달 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 350 } }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 space-y-4"
            >
              <div>
                <span className="text-2xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nutrition Info</span>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
                  {formatKoreanDate(selectedDate)} 영양 정보
                </h3>
              </div>

              {/* 매크로 카드 */}
              {(selectedNutrition.carbs !== undefined || selectedNutrition.protein !== undefined || selectedNutrition.fat !== undefined) && (
                <div className="grid grid-cols-3 gap-2 text-center rounded-2xl bg-zinc-50 p-3 dark:bg-white/5">
                  <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                    <div className="text-[10px] font-semibold">탄수화물</div>
                    <div className="text-xs font-black">{selectedNutrition.carbs ?? "-"}g</div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                    <div className="text-[10px] font-semibold">단백질</div>
                    <div className="text-xs font-black">{selectedNutrition.protein ?? "-"}g</div>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 p-2 text-rose-700 dark:text-rose-300">
                    <div className="text-[10px] font-semibold">지방</div>
                    <div className="text-xs font-black">{selectedNutrition.fat ?? "-"}g</div>
                  </div>
                </div>
              )}

              <div className="max-h-60 overflow-y-auto rounded-2xl bg-zinc-50 p-4 dark:bg-white/5">
                <p className="whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {selectedMeal.nutrition?.replace(/<br\/?>/gi, "\n") ?? "등록된 영양 정보가 없습니다."}
                </p>
              </div>

              <Button onClick={() => setIsNutritionOpen(false)} className="w-full">
                닫기
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
