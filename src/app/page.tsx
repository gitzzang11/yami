"use client";

import { useEffect, useState } from "react";
import { BarChart3, Calendar, Home, Settings, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarPanel } from "@/features/calendar/calendar-panel";
import { CriteriaEditor } from "@/features/criteria/criteria-editor";
import { HomeDashboard } from "@/features/home/home-dashboard";
import { SchoolSearch } from "@/features/school/school-search";
import { SettingsPanel } from "@/features/settings/settings-panel";
import { StatsPanel } from "@/features/stats/stats-panel";
import { useMealData } from "@/hooks/use-meal-data";
import { usePwa } from "@/hooks/use-pwa";
import { useAppStore } from "@/stores/app-store";
import { scheduleDailyMealNotification, disableMealNotification } from "@/services/notifications";
import { NotificationToast } from "@/components/ui/toast";

export default function App() {
  usePwa();
  const { settings, setSchool, hasHydrated } = useAppStore();
  const [activeTab, setActiveTab] = useState("home");
  const tabIndices: Record<string, number> = {
    home: 0,
    calendar: 1,
    stats: 2,
    criteria: 3,
    settings: 4,
  };
  const activeIndex = tabIndices[activeTab] ?? 0;
  const { today, tomorrow, week, review, setReview, state, error, offline, reload } = useMealData(
    settings.selectedSchool,
    settings.neisApiKey,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
    document.documentElement.style.setProperty("--theme", settings.themeColor);
  }, [settings.darkMode, settings.themeColor]);

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
  }, [hasHydrated, settings.notificationsEnabled, settings.notificationTime, today, review]);

  if (!hasHydrated) {
    return <main className="min-h-dvh bg-app" />;
  }

  return (
    <main className="min-h-dvh bg-app px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-zinc-950 dark:text-white sm:px-6">
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
                    className="grid grid-cols-5 h-16 items-center gap-1 rounded-full border border-white/15 dark:border-white/15 bg-zinc-900/60 dark:bg-black/40 p-1.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.37)] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] relative"
                    style={{
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                    }}
                  >
                    <motion.div
                      className="active-tab-bg absolute w-[calc((100%-0.75rem)/5)]"
                      animate={{
                        left: `calc(0.375rem + (100% - 0.75rem) / 5 * ${activeIndex})`
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                    <TabsTrigger
                      value="home"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-400 transition-colors duration-200 select-none cursor-pointer relative"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-colors ${activeTab === "home" ? "text-white dark:text-theme-active" : ""}`}>
                        <Home className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">홈</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="calendar"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-400 transition-colors duration-200 select-none cursor-pointer relative"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-colors ${activeTab === "calendar" ? "text-white dark:text-theme-active" : ""}`}>
                        <Calendar className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">달력</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="stats"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-400 transition-colors duration-200 select-none cursor-pointer relative"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-colors ${activeTab === "stats" ? "text-white dark:text-theme-active" : ""}`}>
                        <BarChart3 className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">통계</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="criteria"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-400 transition-colors duration-200 select-none cursor-pointer relative"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-colors ${activeTab === "criteria" ? "text-white dark:text-theme-active" : ""}`}>
                        <SlidersHorizontal className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">기준</span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className="flex flex-col items-center justify-center gap-1 rounded-full h-full text-zinc-400 transition-colors duration-200 select-none cursor-pointer relative"
                    >
                      <span className={`relative z-10 flex flex-col items-center gap-1 transition-colors ${activeTab === "settings" ? "text-white dark:text-theme-active" : ""}`}>
                        <Settings className="h-4.5 w-4.5" />
                        <span className="text-[10px] font-bold">설정</span>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="home">
                  <HomeDashboard
                    school={settings.selectedSchool}
                    today={today}
                    tomorrow={tomorrow}
                    week={week}
                    review={review}
                    state={state}
                    error={error}
                    offline={offline}
                    onReload={reload}
                    onReview={setReview}
                  />
                </TabsContent>
                <TabsContent value="calendar"><CalendarPanel /></TabsContent>
                <TabsContent value="stats"><StatsPanel /></TabsContent>
                <TabsContent value="criteria"><CriteriaEditor /></TabsContent>
                <TabsContent value="settings"><SettingsPanel today={today} review={review} /></TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
