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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { db } from "@/db/app-db";
import { scoreTone, formatKoreanDate } from "@/lib/utils";
import { evaluateMealWithGemini } from "@/services/gemini";
import { getMealsByRange } from "@/services/neis";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, Meal } from "@/types";

export function CalendarPanel() {
  const { settings, criteria } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 급식 및 AI 평가 데이터 가져오기
  const loadMonthData = useCallback(async (month: Date) => {
    if (!settings.selectedSchool) return;
    setIsLoading(true);
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      // 1. NEIS API에서 한 달 치 급식 조회
      const fetchedMeals = await getMealsByRange(
        settings.selectedSchool,
        start,
        end,
        settings.neisApiKey
      );
      setMeals(fetchedMeals);

      // 2. IndexedDB에서 한 달 치 AI 리뷰 조회
      const startStr = format(start, "yyyyMMdd");
      const endStr = format(end, "yyyyMMdd");
      const fetchedReviews = await db.reviews
        .where("date")
        .between(startStr, endStr, true, true)
        .toArray();
      setReviews(fetchedReviews);
    } catch (error) {
      console.error("캘린더 데이터를 불러오는 중 오류가 발생했습니다.", error);
    } finally {
      setIsLoading(false);
    }
  }, [settings.selectedSchool, settings.neisApiKey]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadMonthData(currentMonth);
    }, 0);
    return () => window.clearTimeout(task);
  }, [currentMonth, loadMonthData]);

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
  const selectedTone = scoreTone(selectedReview?.totalScore);

  // 실시간 AI 평가 트리거
  const handleEvaluate = () => {
    if (!selectedMeal) return;
    startTransition(async () => {
      try {
        await evaluateMealWithGemini(
          selectedMeal,
          criteria,
          settings.geminiApiKey,
          settings.geminiModel
        );
        // 캐시 데이터 새로 불러오기
        await loadMonthData(currentMonth);
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
            const review = reviewMap.get(dateStr);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayTone = scoreTone(review?.totalScore);

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
                  ) : (
                    // 급식이 없는 날은 미표시
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
            <h2 className="text-lg font-black">{formatKoreanDate(selectedDate)}</h2>
            {selectedMeal && (
              <span className="text-xs font-bold rounded-full bg-zinc-100 px-3 py-1 dark:bg-white/10">
                {selectedMeal.calories ?? "칼로리 정보 없음"}
              </span>
            )}
          </div>

          {selectedMeal ? (
            <div className="space-y-4">
              {/* 급식 식단 카드 */}
              <Card className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.1),transparent_30%)] p-4">
                <CardTitle className="flex items-center gap-2 mb-3 text-sm">
                  <Utensils className="h-4 w-4" />
                  급식 식단
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {selectedMeal.menu.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold shadow-sm dark:bg-white/10"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </Card>

              {/* AI 비평 평론 카드 */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      AI 급식 평가
                    </p>
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
              이 날은 급식이 없거나 등록되지 않은 날입니다.
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
