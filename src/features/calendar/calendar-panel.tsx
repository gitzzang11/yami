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
import { BookOpen, Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, History, Sparkles, Trash2, Utensils } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EvaluatingAnimation } from "@/components/evaluating-animation";
import { MenuReactionChip, getReactionConfig } from "@/components/menu-reaction-chip";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { db } from "@/db/app-db";
import { formatKoreanDate, parseNutritionInfo, scoreTone, cn } from "@/lib/utils";
import { USER_REACTION_CONFIG } from "@/services/feedback";
import { CRITIC_PERSONAS, deleteReviewById, evaluateMealWithGemini } from "@/services/gemini";
import { getMealsByRange, getSchoolSchedulesByRange } from "@/services/neis";
import { scheduleKeywordMealNotifications } from "@/services/notifications";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, CriticPersonaId, Meal, MealKind, MenuReactionType, ScheduleEventType, SchoolScheduleEvent, UserMealFeedback } from "@/types";

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
  const { settings, criteria, setMenuReaction } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [calendarKind, setCalendarKind] = useState<MealKind>(settings.preferredMealKind ?? "lunch");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [schedules, setSchedules] = useState<SchoolScheduleEvent[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserMealFeedback[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<number>(0);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<CriticPersonaId>(
    settings.criticPersona ?? "student",
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isNutritionOpen, setIsNutritionOpen] = useState(false);

  const userAllergies = settings.userAllergies ?? [];
  const favoriteKeywords = settings.favoriteKeywords ?? [];
  const menuReactions = settings.menuReactions ?? {};

  // 메시지 앱 스타일 빠른 반응 (따봉, 하트, 역따봉, 슬픔 등) 선택 핸들러
  const handleSelectMenuReaction = (rawName: string, reaction: MenuReactionType | null) => {
    const cleanName = rawName.replace(/\([0-9.]+\)/g, "").trim();
    if (!cleanName) return;

    setMenuReaction(cleanName, reaction);

    const currentFavorites = settings.favoriteKeywords ?? [];
    let nextFavorites: string[];

    if (!reaction) {
      showToast({
        type: "unheart",
        message: `'${cleanName}' 반응 해제`,
        subMessage: "선택한 평가 반응이 취소되었습니다.",
      });
      nextFavorites = currentFavorites.filter(
        (k) =>
          k.toLowerCase() !== cleanName.toLowerCase() &&
          !cleanName.toLowerCase().includes(k.toLowerCase()) &&
          !k.toLowerCase().includes(cleanName.toLowerCase()),
      );
    } else {
      const config = getReactionConfig(reaction);
      if (config) {
        showToast({
          type: config.toastType,
          message: `'${cleanName}' ${config.toastMessage}`,
          subMessage: config.toastSub,
        });
      }

      if (reaction === "❤️") {
        nextFavorites = currentFavorites.includes(cleanName)
          ? currentFavorites
          : [...currentFavorites, cleanName];
      } else {
        nextFavorites = currentFavorites.filter(
          (k) =>
            k.toLowerCase() !== cleanName.toLowerCase() &&
            !cleanName.toLowerCase().includes(k.toLowerCase()) &&
            !k.toLowerCase().includes(cleanName.toLowerCase()),
        );
      }
    }

    // 최애 메뉴 알림 즉시 동기화
    if (settings.keywordNotificationsEnabled && settings.selectedSchool?.schoolCode) {
      scheduleKeywordMealNotifications(
        settings.notificationTime,
        nextFavorites,
        settings.selectedSchool.schoolCode,
      );
    }
  };

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

  const reviewsMap = new Map<string, AiReview[]>();
  reviews.forEach((r) => {
    const list = reviewsMap.get(r.date) || [];
    list.push(r);
    reviewsMap.set(r.date, list);
  });
  reviewsMap.forEach((list) => list.sort((a, b) => b.createdAt - a.createdAt));

  const scheduleMap = new Map<string, SchoolScheduleEvent[]>();
  schedules.forEach((s) => {
    const list = scheduleMap.get(s.date) || [];
    list.push(s);
    scheduleMap.set(s.date, list);
  });

  const feedbackMap = new Map<string, UserMealFeedback>();
  feedbacks.forEach((f) => feedbackMap.set(f.date, f));

  const handlePrevMonth = () => {
    setDirection(-1);
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setDirection(1);
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // 선택한 날짜에 해당하는 정보
  const selectedDateStr = format(selectedDate, "yyyyMMdd");
  const selectedMeal = mealMap.get(selectedDateStr);
  const selectedReviews = reviewsMap.get(selectedDateStr) ?? [];
  const selectedReview = (activeReviewId ? selectedReviews.find((r) => r.id === activeReviewId) : undefined) ?? selectedReviews[0];
  const selectedSchedules = scheduleMap.get(selectedDateStr) ?? [];
  const selectedFeedback = feedbackMap.get(selectedDateStr);
  const selectedTone = scoreTone(selectedReview?.totalScore);
  const selectedNutrition = parseNutritionInfo(selectedMeal?.nutrition, selectedMeal?.calories);

  // 실시간 AI 평가 트리거
  const handleEvaluate = (personaToUse?: CriticPersonaId) => {
    if (!selectedMeal) return;
    const targetPersona = personaToUse ?? selectedPersona ?? settings.criticPersona ?? "student";
    startTransition(async () => {
      try {
        await evaluateMealWithGemini(
          selectedMeal,
          criteria,
          settings.geminiApiKey,
          settings.geminiModel,
          settings.selectedSchool?.kind,
          targetPersona,
        );
        // 캐시 데이터 새로 불러오기
        await loadMonthData(currentMonth, calendarKind);
        setActiveReviewId(null);
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
          <div className="h-8 overflow-hidden relative flex items-center min-w-[140px]">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.h1
                key={format(currentMonth, "yyyy-MM")}
                custom={direction}
                initial={{ opacity: 0, x: direction * 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 25 }}
                transition={{ duration: 0.2 }}
                className="text-2xl font-black tracking-tight"
              >
                {format(currentMonth, "yyyy년 M월")}
              </motion.h1>
            </AnimatePresence>
          </div>
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

      {/* 캘린더 그리드 (스와이프 & 슬라이드 애니메이션) */}
      <Card className="p-3 overflow-hidden relative">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-bold mb-2">
          {[
            { label: "일", className: "text-rose-500 font-black" },
            { label: "월", className: "text-zinc-400 dark:text-zinc-500" },
            { label: "화", className: "text-zinc-400 dark:text-zinc-500" },
            { label: "수", className: "text-zinc-400 dark:text-zinc-500" },
            { label: "목", className: "text-zinc-400 dark:text-zinc-500" },
            { label: "금", className: "text-zinc-400 dark:text-zinc-500" },
            { label: "토", className: "text-sky-500 font-black" },
          ].map((w) => (
            <div key={w.label} className={cn("py-1", w.className)}>
              {w.label}
            </div>
          ))}
        </div>

        {/* 일자 셀 (스와이프 제스처 및 방향별 슬라이드 모션) */}
        <div className="relative overflow-hidden min-h-[260px]">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={format(currentMonth, "yyyy-MM")}
              custom={direction}
              variants={{
                enter: (dir: number) => ({
                  x: dir > 0 ? 100 : dir < 0 ? -100 : 0,
                  opacity: 0,
                }),
                center: {
                  x: 0,
                  opacity: 1,
                  transition: {
                    x: { type: "spring", stiffness: 350, damping: 30 },
                    opacity: { duration: 0.2 },
                  },
                },
                exit: (dir: number) => ({
                  x: dir > 0 ? -100 : dir < 0 ? 100 : 0,
                  opacity: 0,
                  transition: {
                    x: { type: "spring", stiffness: 350, damping: 30 },
                    opacity: { duration: 0.15 },
                  },
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_e, { offset, velocity }) => {
                const swipeThreshold = 40;
                const velocityThreshold = 350;
                if (offset.x > swipeThreshold || velocity.x > velocityThreshold) {
                  handlePrevMonth();
                } else if (offset.x < -swipeThreshold || velocity.x < -velocityThreshold) {
                  handleNextMonth();
                }
              }}
              className="grid grid-cols-7 gap-1 touch-pan-y cursor-grab active:cursor-grabbing select-none"
            >
              {days.map((day) => {
                const dateStr = format(day, "yyyyMMdd");
                const hasMeal = mealMap.has(dateStr);
                const mealForDay = mealMap.get(dateStr);
                const dayReviews = reviewsMap.get(dateStr) ?? [];
                const review = dayReviews[0];
                const daySchedules = scheduleMap.get(dateStr) ?? [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const dayTone = scoreTone(review?.totalScore);
                const isSunday = day.getDay() === 0;
                const isSaturday = day.getDay() === 6;

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
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
                      setSelectedDate(day);
                    }}
                    className={`relative flex flex-col items-center justify-between aspect-square p-1 rounded-2xl transition-all active:scale-90 cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-[var(--theme)] bg-white/60 dark:bg-white/10 shadow-xs"
                        : "hover:bg-zinc-100/70 dark:hover:bg-white/5"
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
                      className={cn(
                        "text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full",
                        isToday
                          ? "bg-[var(--theme)] text-white shadow-xs"
                          : isCurrentMonth
                            ? isSunday
                              ? "text-rose-500 font-black"
                              : isSaturday
                                ? "text-sky-500 font-black"
                                : "text-zinc-950 dark:text-white"
                            : isSunday
                              ? "text-rose-300/60 dark:text-rose-900/60"
                              : isSaturday
                                ? "text-sky-300/60 dark:text-sky-900/60"
                                : "text-zinc-300 dark:text-zinc-700",
                      )}
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 하단 스와이프 안내 힌트 */}
        <div className="flex items-center justify-center gap-1.5 pt-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 select-none">
          <ChevronLeft className="h-3 w-3 animate-pulse" />
          <span>좌우로 스와이프하여 이전/다음 달 이동</span>
          <ChevronRight className="h-3 w-3 animate-pulse" />
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
          <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-800 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black">
                {formatKoreanDate(selectedDate)} ({MEAL_KIND_LABELS[calendarKind]})
              </h2>
              {selectedSchedules.length > 0 && (
                <span
                  onClick={() => setIsScheduleOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-2xs font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/30 cursor-pointer hover:bg-indigo-500/20 transition"
                  title="하단 학사 일정 열기"
                >
                  <BookOpen className="h-3 w-3" />
                  {selectedSchedules.map((s) => s.eventName).join(", ")}
                </span>
              )}
            </div>
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

          {selectedMeal ? (
            <div className="space-y-4">
              {/* 급식 식단 카드 */}
              <Card className="bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.1),transparent_30%)] dark:bg-none p-4 overflow-visible">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Utensils className="h-4 w-4" />
                    급식 식단
                  </CardTitle>
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full ring-1 ring-amber-400/30">
                    <span>⚡</span>
                    <span>메뉴 터치 시 빠른 반응 (👍, ❤️, 👎, 🤢)</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedMeal.menuItems && selectedMeal.menuItems.length > 0
                    ? selectedMeal.menuItems.map((item) => {
                        const cleanName = item.name.replace(/\([0-9.]+\)/g, "").trim();
                        const hasAllergy =
                          userAllergies.length > 0 &&
                          item.allergies.some((a) => userAllergies.includes(a));
                        const isFavorite = favoriteKeywords.some(
                          (k) =>
                            k.toLowerCase() === cleanName.toLowerCase() ||
                            cleanName.toLowerCase().includes(k.toLowerCase()) ||
                            k.toLowerCase().includes(cleanName.toLowerCase()),
                        );
                        const currentReaction = menuReactions[cleanName] ?? (isFavorite ? "❤️" : null);

                        return (
                          <MenuReactionChip
                            key={item.raw || item.name}
                            name={item.name}
                            raw={item.raw}
                            allergies={item.allergies}
                            hasAllergyWarning={hasAllergy}
                            currentReaction={currentReaction}
                            isFavorite={isFavorite}
                            onSelectReaction={(reaction) =>
                              handleSelectMenuReaction(item.name, reaction)
                            }
                            size="sm"
                          />
                        );
                      })
                    : selectedMeal.menu.map((item) => {
                        const cleanName = item.replace(/\([0-9.]+\)/g, "").trim();
                        const isFavorite = favoriteKeywords.some(
                          (k) =>
                            k.toLowerCase() === cleanName.toLowerCase() ||
                            cleanName.toLowerCase().includes(k.toLowerCase()) ||
                            k.toLowerCase().includes(cleanName.toLowerCase()),
                        );
                        const currentReaction = menuReactions[cleanName] ?? (isFavorite ? "❤️" : null);

                        return (
                          <MenuReactionChip
                            key={item}
                            name={item}
                            currentReaction={currentReaction}
                            isFavorite={isFavorite}
                            onSelectReaction={(reaction) =>
                              handleSelectMenuReaction(item, reaction)
                            }
                            size="sm"
                          />
                        );
                      })}
                </div>
              </Card>

              {/* AI 비평 평론 카드 */}
              <Card className="space-y-4">
                {/* 페르소나 평가 히스토리 탭 칩 목록 (여러 평가가 존재할 때 빠른 전환) */}
                {selectedReviews.length > 0 && (
                  <div className="space-y-1.5 pb-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="flex items-center justify-between text-2xs font-black text-zinc-400 dark:text-zinc-500">
                      <span>페르소나별 평가 기록 ({selectedReviews.length}건)</span>
                      <span className="text-[10px] text-zinc-400">칩을 눌러 전환</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {selectedReviews.map((r, idx) => {
                        const p = CRITIC_PERSONAS[r.persona || "student"];
                        const isCurrent = selectedReview?.id === r.id;
                        const rTone = scoreTone(r.totalScore);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setActiveReviewId(r.id)}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black transition-all shrink-0 cursor-pointer ${
                              isCurrent
                                ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950 ring-2 ring-[var(--theme)] scale-105"
                                : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300"
                            }`}
                          >
                            <span>{p?.icon || "🎓"}</span>
                            <span>{r.personaName || p?.name}</span>
                            <span className={`text-[11px] font-bold ${isCurrent ? "" : rTone.textClassName}`}>
                              {r.totalScore}점
                            </span>
                            {idx === 0 && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                                최신
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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

                {/* 📜 전체 평가 히스토리 타임라인 아코디언 */}
                {selectedReviews.length > 1 && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                      className="flex items-center justify-between w-full py-1 text-xs font-black text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="h-4 w-4 text-[var(--theme)]" />
                        전체 평가 히스토리 ({selectedReviews.length}건)
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isHistoryOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isHistoryOpen && (
                      <div className="mt-3 space-y-2">
                        {selectedReviews.map((r, idx) => {
                          const p = CRITIC_PERSONAS[r.persona || "student"];
                          const rTone = scoreTone(r.totalScore);
                          const isSelected = selectedReview?.id === r.id;
                          const timeStr = new Date(r.createdAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <div
                              key={r.id}
                              className={`flex items-center justify-between gap-3 rounded-2xl p-2.5 transition ${
                                isSelected
                                  ? "bg-zinc-100 dark:bg-white/15 ring-1.5 ring-[var(--theme)] shadow-xs"
                                  : "bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100/60 dark:hover:bg-white/10"
                              }`}
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left cursor-pointer"
                                onClick={() => setActiveReviewId(r.id)}
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm">{p?.icon || "🎓"}</span>
                                  <span className="text-xs font-black text-zinc-900 dark:text-white">
                                    {r.personaName || p?.name}
                                  </span>
                                  <span className="text-2xs text-zinc-400 font-medium">
                                    {timeStr}
                                  </span>
                                  {idx === 0 && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                                      최신
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 line-clamp-1">
                                  &ldquo;{r.oneLine}&rdquo;
                                </p>
                              </button>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-black ${rTone.textClassName}`}>
                                  {r.totalScore}점
                                </span>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await deleteReviewById(r.id);
                                    await loadMonthData(currentMonth, calendarKind);
                                    if (activeReviewId === r.id) {
                                      setActiveReviewId(null);
                                    }
                                  }}
                                  className="p-1 text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                                  title="이 평가 기록 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 페르소나 선택 칩 바 (평가할 페르소나 선택) */}
                <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-2">
                  <div className="flex items-center justify-between text-2xs font-black text-zinc-500 dark:text-zinc-400">
                    <span>비평가 페르소나 선택:</span>
                    <span className="text-[var(--theme)] font-bold">{CRITIC_PERSONAS[selectedPersona]?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {(Object.keys(CRITIC_PERSONAS) as CriticPersonaId[]).map((pId) => {
                      const p = CRITIC_PERSONAS[pId];
                      const isSelected = selectedPersona === pId;
                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => setSelectedPersona(pId)}
                          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 px-1.5 text-2xs font-black transition cursor-pointer whitespace-nowrap overflow-hidden ${
                            isSelected
                              ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950 ring-1 ring-[var(--theme)]"
                              : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                          }`}
                        >
                          <span className="shrink-0">{p.icon}</span>
                          <span className="truncate">{p.name.replace(" 셰프", "").replace(" 선생님", "").replace(" 분석관", "")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isPending && (
                  <EvaluatingAnimation persona={selectedPersona} compact />
                )}

                <Button
                  onClick={() => handleEvaluate(selectedPersona)}
                  disabled={isPending}
                  className="w-full whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="truncate">{isPending ? "평가 진행 중..." : `${CRITIC_PERSONAS[selectedPersona]?.name}로 평가하기`}</span>
                </Button>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center space-y-2.5 bg-gradient-to-br from-white via-zinc-50/50 to-amber-50/20 dark:from-zinc-900 dark:via-zinc-900/60 dark:to-amber-950/10 border-dashed border-zinc-300 dark:border-zinc-800">
              <div className="text-4xl">🏖️</div>
              <div className="text-base font-black text-zinc-800 dark:text-zinc-200">
                {selectedSchedules.length > 0
                  ? `${selectedSchedules.map((s) => s.eventName).join(", ")} (급식 없음)`
                  : `선택하신 날짜는 ${MEAL_KIND_LABELS[calendarKind]} 정보가 없습니다.`}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto break-keep">
                주말, 공휴일, 재량휴업일 또는 방학 기간에는 학교 급식이 제공되지 않습니다.
              </p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 📅 학사 일정 카드 (화면 최하단 배치 & 열고 닫기 토글) */}
      {schedules.length > 0 && (
        <Card className="overflow-hidden border-indigo-200/50 dark:border-indigo-950/40 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/10 dark:from-zinc-900 dark:via-indigo-950/10 dark:to-zinc-900">
          <button
            type="button"
            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
            className="flex w-full items-center justify-between p-4 text-left transition cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                    {format(currentMonth, "M월")} 학사 일정
                  </h3>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-2xs font-bold text-indigo-700 dark:text-indigo-300">
                    총 {schedules.length}건
                  </span>
                </div>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  {isScheduleOpen
                    ? "클릭하여 학사 일정을 닫습니다"
                    : "시험, 방학, 공휴일 및 행사 일정 확인하기"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {isScheduleOpen ? "닫기" : "열기"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                  isScheduleOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {/* 열렸을 때 표시되는 학사 일정 상세 & 타임라인 */}
          <AnimatePresence>
            {isScheduleOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="border-t border-indigo-100/80 p-4 space-y-4 dark:border-white/5"
              >
                {/* 선택한 날짜에 학사 일정이 있는 경우 강조 표시 */}
                {selectedSchedules.length > 0 && (
                  <div className="rounded-2xl bg-indigo-500/10 p-3.5 space-y-2 border border-indigo-200/50 dark:border-indigo-800/30">
                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                      <span>📌</span>
                      <span>선택한 날짜 ({formatKoreanDate(selectedDate)}) 학사 일정</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedSchedules.map((schedule) => {
                        const config = EVENT_TYPE_CONFIG[schedule.eventType];
                        return (
                          <div
                            key={schedule.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-white/80 p-2.5 shadow-2xs dark:bg-black/30"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-black ${config.badgeClass}`}>
                                {config.icon} {config.label}
                              </span>
                              <span className="text-xs font-black text-zinc-900 dark:text-white">
                                {schedule.eventName}
                              </span>
                            </div>
                            {schedule.gradeTarget && (
                              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-3xs font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                                {schedule.gradeTarget}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 이달의 전체 학사 일정 목록 */}
                <div className="space-y-1">
                  <div className="text-2xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    이달의 전체 일정 목록
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-60 overflow-y-auto">
                    {schedules.map((schedule) => {
                      const config = EVENT_TYPE_CONFIG[schedule.eventType];
                      const dayNum = Number(schedule.date.slice(6, 8));
                      const isSelectedDay = schedule.date === selectedDateStr;
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
                          className={`w-full flex items-center justify-between py-2 px-2 rounded-xl transition cursor-pointer text-left ${
                            isSelectedDay
                              ? "bg-indigo-500/10 dark:bg-indigo-500/20 font-black"
                              : "hover:bg-zinc-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="w-8 text-xs font-black text-zinc-400 dark:text-zinc-500">
                              {dayNum}일
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-black ${config.badgeClass}`}
                            >
                              {config.icon} {config.label}
                            </span>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {schedule.eventName}
                            </span>
                          </div>
                          <div className="text-2xs font-medium text-zinc-400 shrink-0 ml-2">
                            {schedule.gradeTarget || ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
