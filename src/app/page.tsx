"use client";

import { useEffect } from "react";
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

export default function App() {
  usePwa();
  const { settings, setSchool, hasHydrated } = useAppStore();
  const { today, tomorrow, week, review, setReview, state, error, offline, reload } = useMealData(
    settings.selectedSchool,
    settings.neisApiKey,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
    document.documentElement.style.setProperty("--theme", settings.themeColor);
  }, [settings.darkMode, settings.themeColor]);

  if (!hasHydrated) {
    return <main className="min-h-dvh bg-app" />;
  }

  return (
    <main className="min-h-dvh bg-app px-4 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))] text-zinc-950 dark:text-white sm:px-6">
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
              <Tabs defaultValue="home">
                <div className="sticky top-[calc(0.75rem+env(safe-area-inset-top))] z-20 mb-5">
                  <TabsList className="mx-auto max-w-md grid-cols-5 shadow-lg shadow-zinc-900/10 backdrop-blur-xl">
                    <TabsTrigger value="home" aria-label="홈"><Home className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="calendar" aria-label="달력"><Calendar className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="stats" aria-label="통계"><BarChart3 className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="criteria" aria-label="평가 기준"><SlidersHorizontal className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="settings" aria-label="설정"><Settings className="h-4 w-4" /></TabsTrigger>
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
