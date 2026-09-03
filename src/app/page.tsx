"use client";

import { useEffect, useState } from "react";
import { BarChart3, Calendar, Home, Settings } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarPanel } from "@/features/calendar/calendar-panel";
import { HomeDashboard } from "@/features/home/home-dashboard";
import { SchoolSearch } from "@/features/school/school-search";
import { SettingsPanel } from "@/features/settings/settings-panel";
import { StatsPanel } from "@/features/stats/stats-panel";
import { useMealData } from "@/hooks/use-meal-data";
import { usePwa } from "@/hooks/use-pwa";
import { useAppStore } from "@/stores/app-store";
import { scheduleDailyMealNotification, disableMealNotification, scheduleKeywordMealNotifications } from "@/services/notifications";
import { syncMealWidget } from "@/services/widget";
import { NotificationToast } from "@/components/ui/toast";

export default function App() {
  usePwa();
  const { settings, setSchool, updateSettings, hasHydrated } = useAppStore();
  const [activeTab, setActiveTab] = useState("home");
  const tabIndices: Record<string, number> = {
    home: 0,
    calendar: 1,
    stats: 2,
    settings: 3,
  };
  const activeIndex = tabIndices[activeTab] ?? 0;
  const {
    mealKind,
    setMealKind,
    today,
    tomorrow,
    week,
    reviews,
    setReviews,
    review,
    setReview,
    todaySchedules,
    todayFeedback,
    setTodayFeedback,
    state,
    error,
    offline,
    reload,
  } = useMealData(
    settings.selectedSchool,
    settings.neisApiKey,
    settings.preferredMealKind ?? "lunch",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", settings.darkMode ? "#090a0f" : "#ffffff");
    }
  }, [settings.darkMode]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (settings.notificationsEnabled) {
      scheduleDailyMealNotification(settings.notificationTime, today, review).catch((err) =>
        console.error("자동 알림 갱신 실패", err),
      );
    } else {
      // 알림이 꺼진 상태에서도 혹시 남아있는 예약 알림을 확실히 취소
      disableMealNotification().catch((err) =>
        console.error("알림 잔여 취소 실패", err),
      );
    }

    if (settings.keywordNotificationsEnabled && settings.selectedSchool) {
      scheduleKeywordMealNotifications(
        settings.notificationTime,
        settings.favoriteKeywords ?? [],
        settings.selectedSchool.schoolCode,
      ).catch((err) => console.error("최애 메뉴 키워드 알림 갱신 실패", err));
    }

    // Android 홈 화면 위젯 실시간 동기화
    if (settings.selectedSchool) {
      syncMealWidget(settings.selectedSchool, today, settings.favoriteKeywords ?? []).catch((err) =>
        console.warn("홈 화면 위젯 갱신 실패 (무시 가능)", err),
      );
    }
  }, [
    hasHydrated,
    settings.notificationsEnabled,
    settings.keywordNotificationsEnabled,
    settings.notificationTime,
    settings.favoriteKeywords,
    settings.selectedSchool,
    today,
    review,
  ]);

  if (!hasHydrated) {
    return <main className="min-h-dvh bg-app" />;
  }

  return (
    <main className="min-h-dvh bg-app px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-zinc-950 dark:text-white sm:px-6">
      {/* 상단 상태표시줄(Status Bar) 가독성 보호를 위한 자연스러운 페이드 아웃 스크림 */}
      <div
        className="fixed top-0 left-0 right-0 z-20 pointer-events-none h-[calc(env(safe-area-inset-top,0px)+2.75rem)] bg-gradient-to-b from-white via-white/80 to-transparent dark:from-[#090a0f] dark:via-[#090a0f]/85 dark:to-transparent transition-colors duration-200"
        aria-hidden="true"
      />
      <NotificationToast />
      <div className="mx-auto max-w-5xl">
        <AnimatePresence mode="wait">
          {!settings.selectedSchool ? (
            <motion.div
              key="school"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="grid min-h-[calc(100dvh-3rem)] place-items-center"
            >
              <div className="w-full max-w-lg">
                <div className="mb-6">
                  <p className="text-sm font-black text-zinc-500 dark:text-zinc-400">급식평론가</p>
                  <h1 className="mt-1 text-4xl font-black tracking-tight">오늘 급식, AI가 먼저 먹어봅니다</h1>
                </div>
                <SchoolSearch apiKey={settings.neisApiKey} onSelect={setSchool} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md">
                  <TabsList
                    className="grid grid-cols-4 h-16 items-center gap-1 rounded-full p-1.5 relative border transition-colors duration-200 bg-white dark:bg-[#111318] border-zinc-200/90 dark:border-zinc-800/90 shadow-[0_12px_36px_-4px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(15,23,42,0.06)] dark:shadow-none"
                  >
                    <motion.div
                      className="active-tab-bg absolute w-[calc((100%-0.75rem)/4)]"
                      animate={{
                        left: `calc(0.375rem + (100% - 0.75rem) / 4 * ${activeIndex})`
                      }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                    <TabsTrigger
                      value="home"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors duration-200 select-none cursor-pointer relative whitespace-nowrap"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-all duration-200 ${
                        activeTab === "home"
                          ? "text-white font-black scale-105"
                          : "font-semibold"
                      }`}>
                        <Home className="h-4.5 w-4.5 shrink-0" />
                        <span className="text-[10px] tracking-tight whitespace-nowrap">홈</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="calendar"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors duration-200 select-none cursor-pointer relative whitespace-nowrap"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-all duration-200 ${
                        activeTab === "calendar"
                          ? "text-white font-black scale-105"
                          : "font-semibold"
                      }`}>
                        <Calendar className="h-4.5 w-4.5 shrink-0" />
                        <span className="text-[10px] tracking-tight whitespace-nowrap">달력</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="stats"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors duration-200 select-none cursor-pointer relative whitespace-nowrap"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-all duration-200 ${
                        activeTab === "stats"
                          ? "text-white font-black scale-105"
                          : "font-semibold"
                      }`}>
                        <BarChart3 className="h-4.5 w-4.5 shrink-0" />
                        <span className="text-[10px] tracking-tight whitespace-nowrap">통계</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors duration-200 select-none cursor-pointer relative whitespace-nowrap"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-all duration-200 ${
                        activeTab === "settings"
                          ? "text-white font-black scale-105"
                          : "font-semibold"
                      }`}>
                        <Settings className="h-4.5 w-4.5 shrink-0" />
                        <span className="text-[10px] tracking-tight whitespace-nowrap">설정</span>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="home">
                  <HomeDashboard
                    school={settings.selectedSchool}
                    mealKind={mealKind}
                    onMealKindChange={(k) => {
                      setMealKind(k);
                      updateSettings({ preferredMealKind: k });
                    }}
                    today={today}
                    tomorrow={tomorrow}
                    week={week}
                    review={review}
                    reviews={reviews}
                    todaySchedules={todaySchedules}
                    feedback={todayFeedback}
                    onFeedbackChange={setTodayFeedback}
                    state={state}
                    error={error}
                    offline={offline}
                    onReload={reload}
                    onReview={(r) => {
                      setReview(r);
                      setReviews([r, ...reviews.filter((item) => item.id !== r.id)]);
                    }}
                    onReviewsChange={setReviews}
                  />
                </TabsContent>
                <TabsContent value="calendar"><CalendarPanel /></TabsContent>
                <TabsContent value="stats"><StatsPanel /></TabsContent>
                <TabsContent value="settings"><SettingsPanel today={today} review={review} /></TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
