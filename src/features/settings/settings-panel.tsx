"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Cpu,
  ExternalLink,
  Info,
  MapPin,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  School as SchoolIcon,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { showNotificationToast } from "@/components/ui/toast";
import { clearCachedData, db } from "@/db/app-db";
import { ALLERGIES_MAP, cn, yyyymmdd } from "@/lib/utils";
import { CRITIC_PERSONAS, DEFAULT_GEMINI_MODELS, fetchAvailableGeminiModels } from "@/services/gemini";
import {
  disableMealNotification,
  requestNotificationPermission,
  scheduleDailyMealNotification,
  scheduleKeywordMealNotifications,
  sendTestKeywordNotification,
  sendTestNotification,
} from "@/services/notifications";
import { useAppStore } from "@/stores/app-store";
import { CriteriaEditor } from "@/features/criteria/criteria-editor";
import type { AiReview, Meal, MealKind } from "@/types";

type Props = {
  today?: Meal;
  review?: AiReview;
};

const POPULAR_KEYWORD_PRESETS = [
  "치킨",
  "돈까스",
  "마라탕",
  "스파게티",
  "와플",
  "떡볶이",
  "햄버거",
  "피자",
  "삼겹살",
  "우동",
];

const MEAL_KIND_OPTIONS: { id: MealKind; label: string; desc: string }[] = [
  { id: "breakfast", label: "조식", desc: "아침 식사" },
  { id: "lunch", label: "중식 (기본)", desc: "점심 식사" },
  { id: "dinner", label: "석식", desc: "저녁 식사" },
];

export function SettingsPanel({ today, review }: Props) {
  const {
    settings,
    updateSettings,
    toggleAllergy,
    addFavoriteKeyword,
    removeFavoriteKeyword,
    toggleFavoriteKeyword,
  } = useAppStore();

  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [upcomingFavorites, setUpcomingFavorites] = useState<{ dateStr: string; matchedMenu: string }[]>([]);
  const autoFetchedRef = useRef(false);

  const favoriteKeywords = useMemo(() => settings.favoriteKeywords ?? [], [settings.favoriteKeywords]);
  const userAllergies = useMemo(() => settings.userAllergies ?? [], [settings.userAllergies]);
  const activePersona = CRITIC_PERSONAS[settings.criticPersona ?? "student"] || CRITIC_PERSONAS.student;

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    addFavoriteKeyword(newKeyword.trim());
    setNewKeyword("");
  };

  // 다가오는 최애 급식 탐지
  useEffect(() => {
    let active = true;
    if (!settings.selectedSchool || favoriteKeywords.length === 0) {
      const timer = window.setTimeout(() => {
        if (active) setUpcomingFavorites([]);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    const todayStr = yyyymmdd(new Date());
    db.meals
      .where("schoolCode")
      .equals(settings.selectedSchool.schoolCode)
      .filter((m) => m.date >= todayStr)
      .sortBy("date")
      .then((meals) => {
        if (!active) return;
        const found: { dateStr: string; matchedMenu: string }[] = [];
        for (const meal of meals) {
          const matches = meal.menu.filter((menuName) =>
            favoriteKeywords.some((k) => menuName.toLowerCase().includes(k.toLowerCase())),
          );
          if (matches.length > 0) {
            const month = parseInt(meal.date.slice(4, 6), 10);
            const day = parseInt(meal.date.slice(6, 8), 10);
            found.push({
              dateStr: `${month}월 ${day}일 (${meal.kindName || "중식"})`,
              matchedMenu: matches.join(", "),
            });
          }
        }
        setUpcomingFavorites(found.slice(0, 5));
      });

    return () => {
      active = false;
    };
  }, [settings.selectedSchool, favoriteKeywords]);

  // AI Studio 모델 목록 불러오기
  const loadModels = useCallback(
    async (apiKeyToUse?: string) => {
      const key = (apiKeyToUse ?? settings.geminiApiKey).trim();
      if (!key) {
        setModelStatus({ type: "error", message: "API 키를 먼저 입력해주세요." });
        return;
      }

      setIsLoadingModels(true);
      setModelStatus(null);
      try {
        const models = await fetchAvailableGeminiModels(key);
        updateSettings({ availableGeminiModels: models });
        setModelStatus({
          type: "success",
          message: `AI Studio에서 ${models.length}개의 모델 목록을 최신화했습니다.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "모델 목록을 불러오지 못했습니다.";
        setModelStatus({ type: "error", message: msg });
      } finally {
        setIsLoadingModels(false);
      }
    },
    [settings.geminiApiKey, updateSettings],
  );

  // 마운트 시 API 키가 있을 경우 모델 목록 자동 1회 조회
  useEffect(() => {
    if (
      !autoFetchedRef.current &&
      settings.geminiApiKey?.trim() &&
      (!settings.availableGeminiModels || settings.availableGeminiModels.length === 0)
    ) {
      autoFetchedRef.current = true;
      const timer = window.setTimeout(() => {
        void loadModels(settings.geminiApiKey);
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [settings.geminiApiKey, settings.availableGeminiModels, loadModels]);

  async function toggleNotifications(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      updateSettings({ notificationsEnabled: true });
      await scheduleDailyMealNotification(settings.notificationTime, today, review);
      showNotificationToast("on");
    } else {
      updateSettings({ notificationsEnabled: false });
      await disableMealNotification();
      showNotificationToast("off");
    }
  }

  const modelOptions =
    settings.availableGeminiModels && settings.availableGeminiModels.length > 0
      ? settings.availableGeminiModels
      : DEFAULT_GEMINI_MODELS;

  const isCurrentModelInList = modelOptions.some((m) => m.id === settings.geminiModel);
  const displayedModels = isCurrentModelInList
    ? modelOptions
    : [{ id: settings.geminiModel, displayName: settings.geminiModel }, ...modelOptions];

  return (
    <div className="space-y-7 pb-10">
      {/* ========================================================================= */}
      {/* 📍 0. 상단 히어로: 내 학교 & 설정 프로필 스냅샷 요약 */}
      {/* ========================================================================= */}
      {settings.selectedSchool && (
        <Card className="relative overflow-hidden border-[var(--theme)]/30 bg-gradient-to-br from-white/90 via-white/70 to-[var(--theme)]/10 dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-[var(--theme)]/15">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme)]/15 px-2.5 py-0.5 text-xs font-black text-[var(--theme)]">
                  <SchoolIcon className="h-3.5 w-3.5" />
                  현재 학교
                </span>
                <span className="text-2xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {settings.selectedSchool.kind}
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                {settings.selectedSchool.name}
              </h2>
              {settings.selectedSchool.address && (
                <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{settings.selectedSchool.address}</span>
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateSettings({ selectedSchool: undefined })}
              className="shrink-0 h-10 px-4 font-bold rounded-2xl shadow-sm border border-zinc-200/80 dark:border-white/10 cursor-pointer"
            >
              <SchoolIcon className="h-4 w-4 mr-1.5 text-zinc-600 dark:text-zinc-300" />
              학교 변경
            </Button>
          </div>

          {/* 설정 현황 요약 스냅샷 뱃지 */}
          <div className="mt-4 pt-3.5 border-t border-zinc-200/60 dark:border-white/10 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 dark:bg-black/25">
              <span className="text-base">{activePersona.icon}</span>
              <div className="text-left overflow-hidden">
                <div className="text-[10px] text-zinc-400 font-medium">선택된 비평가</div>
                <div className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">
                  {activePersona.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 dark:bg-black/25">
              <Bell className="h-4 w-4 text-[var(--theme)] shrink-0" />
              <div className="text-left overflow-hidden">
                <div className="text-[10px] text-zinc-400 font-medium">매일 알림</div>
                <div className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                  {settings.notificationsEnabled ? `${settings.notificationTime}` : "꺼짐"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 dark:bg-black/25">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="text-left overflow-hidden">
                <div className="text-[10px] text-zinc-400 font-medium">알레르기 필터</div>
                <div className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                  {userAllergies.length > 0 ? `${userAllergies.length}개 감지 중` : "미설정"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 dark:bg-black/25">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
              <div className="text-left overflow-hidden">
                <div className="text-[10px] text-zinc-400 font-medium">최애 밥도둑</div>
                <div className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                  {favoriteKeywords.length}개 등록
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 🎭 1. AI 급식 비평가 설정 (핵심 정체성) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--theme)]/15 text-[var(--theme)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                AI 급식 비평가 설정
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                식단을 분석하고 평가하는 AI 비평가의 성격과 평가 기준을 맞춤 설정합니다.
              </p>
            </div>
          </div>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
            6인 페르소나
          </span>
        </div>

        <Card className="space-y-5">
          {/* 페르소나 선택 그리드 */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              비평가 페르소나 선택
            </Label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {Object.values(CRITIC_PERSONAS).map((persona) => {
                const isSelected = (settings.criticPersona ?? "student") === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => updateSettings({ criticPersona: persona.id })}
                    className={cn(
                      "flex flex-col text-left p-3.5 rounded-2xl border transition cursor-pointer relative",
                      isSelected
                        ? "border-[var(--theme)] bg-[var(--theme)]/10 ring-2 ring-[var(--theme)] dark:bg-white/10"
                        : "border-zinc-200/70 bg-white/40 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl shrink-0">{persona.icon}</span>
                        <span className="font-black text-sm text-zinc-900 dark:text-white whitespace-nowrap">
                          {persona.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex items-center gap-1 rounded-full bg-[var(--theme)] px-2 py-0.5 text-[10px] font-black text-white whitespace-nowrap shrink-0">
                          <Check className="h-3 w-3 stroke-[3]" /> 선택됨
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug break-keep">
                      {persona.shortDesc}
                    </p>
                    <div className="mt-2 rounded-xl bg-zinc-100/80 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 dark:bg-black/30 dark:text-zinc-300 italic break-keep">
                      &ldquo;{persona.sampleQuote}&rdquo;
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 기본 선호 식사 종류 (조식/중식/석식) */}
          <div className="pt-3 border-t border-zinc-200/60 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  기본 우선 조회 식사
                </Label>
                <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                  홈 화면 진입 및 일일 알림 시 우선 기준으로 볼 식사를 선택합니다.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MEAL_KIND_OPTIONS.map((opt) => {
                const isSelected = (settings.preferredMealKind ?? "lunch") === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ preferredMealKind: opt.id })}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition cursor-pointer",
                      isSelected
                        ? "border-[var(--theme)] bg-[var(--theme)]/15 font-black text-[var(--theme)] shadow-xs"
                        : "border-zinc-200/70 bg-white/40 text-zinc-600 hover:bg-zinc-100/60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400",
                    )}
                  >
                    <Utensils className="h-4 w-4 mb-1" />
                    <span className="text-xs font-bold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 나만의 커스텀 평가 기준 관리 */}
          <div className="pt-4 border-t border-zinc-200/60 dark:border-white/10">
            <CriteriaEditor embedded />
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 🍲 2. 맞춤 식단 & 안심 케어 (밥도둑 키워드 & 알레르기) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                맞춤 식단 & 안심 케어
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                선호하는 메뉴와 피해야 할 알레르기 성분을 세밀하게 관리합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 2-A: 최애 메뉴 (밥도둑) 키워드 알림 */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400 shrink-0" />
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                최애 메뉴 (밥도둑) 레이더 & 알림
              </h4>
            </div>
            <Switch
              checked={settings.keywordNotificationsEnabled ?? false}
              onCheckedChange={async (enabled) => {
                updateSettings({ keywordNotificationsEnabled: enabled });
                if (enabled && settings.selectedSchool) {
                  await requestNotificationPermission();
                  await scheduleKeywordMealNotifications(
                    settings.notificationTime,
                    favoriteKeywords,
                    settings.selectedSchool.schoolCode,
                  );
                  showNotificationToast("on");
                }
              }}
            />
          </div>

          <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-yellow-50/80 to-amber-50/80 p-3 text-xs font-bold text-amber-900 dark:border-amber-800/40 dark:from-yellow-950/20 dark:to-amber-950/20 dark:text-amber-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-950 dark:text-amber-200">
              <span>⚡</span>
              <span>메시지 앱 스타일 빠른 평가 반응 (👍, ❤️, 👎, 🤢)</span>
            </div>
            <p className="text-2xs font-normal text-zinc-600 dark:text-zinc-400 break-keep leading-relaxed">
              달력이나 홈 화면에서 메뉴를 직접 터치하면 메시지 앱처럼 플로팅 반응 팝업(👍, ❤️, 👎, 🤢)이 나타납니다. 특히 <span className="font-bold text-rose-600 dark:text-rose-400">하트(❤️)</span>를 선택하면 형광펜으로 그어지며 최애 메뉴로 등록되고, <span className="font-bold text-amber-700 dark:text-amber-300">전날 저녁(D-1)과 당일(D-DAY)</span>에 재치있는 메시지가 담긴 알림을 보내드립니다.
            </p>
          </div>

          {/* 키워드 직접 추가 입력창 */}
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddKeyword();
              }}
              placeholder="예: 마라탕, 뿌링클, 돈까스"
              className="h-10 text-sm"
            />
            <Button size="sm" onClick={handleAddKeyword} className="shrink-0 h-10 px-4 whitespace-nowrap font-bold cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              추가
            </Button>
          </div>

          {/* 추천 인기 밥도둑 프리셋 태그 */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">
              추천 인기 키워드 (클릭하여 추가/제거)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_KEYWORD_PRESETS.map((preset) => {
                const isSelected = favoriteKeywords.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleFavoriteKeyword(preset)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer select-none active:scale-95 whitespace-nowrap shrink-0",
                      isSelected
                        ? "highlighter-mark ring-1 ring-yellow-400 dark:ring-yellow-400/80 scale-102"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10",
                    )}
                  >
                    <span>{isSelected ? "❤️" : "+"}</span>
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 현재 등록된 키워드 목록 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                등록된 최애 메뉴/키워드 ({favoriteKeywords.length}개)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favoriteKeywords.length > 0 ? (
                favoriteKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1 rounded-full highlighter-mark px-3 py-1 text-xs font-black text-amber-950 dark:text-yellow-200 whitespace-nowrap shrink-0"
                  >
                    <span className="text-xs">❤️</span>
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeFavoriteKeyword(kw)}
                      className="ml-0.5 rounded-full p-0.5 text-amber-800 hover:bg-yellow-400/40 dark:text-yellow-200 cursor-pointer"
                      aria-label={`${kw} 삭제`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-400">등록된 메뉴가 없습니다. 달력에서 메뉴를 클릭하거나 직접 추가해 보세요!</p>
              )}
            </div>
          </div>

          {/* 다가오는 최애 메뉴 미리보기 레이더 */}
          {upcomingFavorites.length > 0 && (
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="whitespace-nowrap">다가오는 최애 급식 포착! ({upcomingFavorites.length}일)</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {upcomingFavorites.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs shadow-2xs dark:bg-zinc-900/80 gap-2"
                  >
                    <span className="font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap shrink-0">
                      {item.dateStr}
                    </span>
                    <span className="font-black text-amber-600 dark:text-amber-300 truncate max-w-[180px]">
                      {item.matchedMenu}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const firstKw = favoriteKeywords[0] || "치킨";
                void sendTestKeywordNotification(firstKw, `${firstKw} 특식 세트`, "d-1");
              }}
              className="w-full font-bold text-2xs sm:text-xs cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5 mr-1" />
              전날(D-1) 알림 테스트
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const firstKw = favoriteKeywords[0] || "치킨";
                void sendTestKeywordNotification(firstKw, `${firstKw} 특식 세트`, "d-day");
              }}
              className="w-full font-bold text-2xs sm:text-xs cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5 mr-1" />
              당일(D-DAY) 알림 테스트
            </Button>
          </div>
        </Card>

        {/* 2-B: 알레르기 안심 알림 */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                알레르기 안심 케어
              </h4>
            </div>
            {userAllergies.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {userAllergies.length}개 감지 중
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 break-keep leading-relaxed">
            주의해야 할 알레르기 성분을 선택하세요. 급식 식단에 포함 시 눈에 띄는 경고 표시가 나타납니다.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(ALLERGIES_MAP).map(([numStr, name]) => {
              const num = Number(numStr);
              const isChecked = userAllergies.includes(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => toggleAllergy(num)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer select-none active:scale-95 whitespace-nowrap shrink-0",
                    isChecked
                      ? "bg-[var(--theme)] text-white shadow-sm ring-1 ring-[var(--theme)]"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15",
                  )}
                >
                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  <span>
                    {num}. {name}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 🔔 3. 알림 센터 (Notification Center) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                알림 센터
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                매일 아침 배달되는 급식 식단과 AI 평가 알림 시간을 제어합니다.
              </p>
            </div>
          </div>
        </div>

        <Card className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white/60 p-4 dark:bg-white/10">
            <div>
              <div className="font-bold text-sm">매일 아침 급식 알림</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                오늘의 급식 메뉴, AI 평가 총점, 대표 한줄평을 알림으로 수신
              </div>
            </div>
            <Switch checked={settings.notificationsEnabled} onCheckedChange={toggleNotifications} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              알림 수신 시간
            </Label>
            <Input
              type="time"
              value={settings.notificationTime}
              onChange={async (event) => {
                updateSettings({ notificationTime: event.target.value });
                if (settings.notificationsEnabled) {
                  await scheduleDailyMealNotification(event.target.value, today, review);
                }
                if (settings.keywordNotificationsEnabled && settings.selectedSchool) {
                  await scheduleKeywordMealNotifications(
                    event.target.value,
                    favoriteKeywords,
                    settings.selectedSchool.schoolCode,
                  );
                }
              }}
              className="h-10 text-sm font-bold"
            />
          </div>

          <Button
            variant="secondary"
            onClick={() => sendTestNotification(today, review)}
            className="w-full font-bold text-xs cursor-pointer"
          >
            <BellOff className="h-3.5 w-3.5 mr-1.5" />
            일일 급식 알림 테스트 발송
          </Button>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 🎨 4. 화면 및 테마 (Display & Appearance) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                화면 및 테마
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                다크 모드 및 마음에 드는 포인트 컬러를 자유롭게 설정합니다.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between rounded-2xl bg-white/60 p-4 dark:bg-white/10">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Moon className="h-4 w-4 text-purple-500" />
              <span>다크 모드</span>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(darkMode) => updateSettings({ darkMode })}
            />
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* ⚙️ 5. 시스템 및 AI 엔진 (API, 모델 & 캐시 관리) */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-500/15 text-zinc-700 dark:text-zinc-300">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                시스템 및 AI 엔진 설정
              </h3>
              <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                Gemini AI 모델 선택, API 키 및 로컬 캐시 데이터를 관리합니다.
              </p>
            </div>
          </div>
          <span className="rounded-md bg-zinc-200/70 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
            고급
          </span>
        </div>

        <Card className="space-y-4">
          {/* Gemini AI 모델 선택 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Gemini AI 평가 모델
              </Label>
              <button
                type="button"
                onClick={() => void loadModels()}
                disabled={isLoadingModels || !settings.geminiApiKey.trim()}
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white disabled:opacity-40 transition cursor-pointer"
                title="Google AI Studio에서 지원 모델 목록 최신화"
              >
                <RefreshCw className={cn("h-3 w-3", isLoadingModels && "animate-spin")} />
                <span>{isLoadingModels ? "조회 중..." : "목록 새로고침"}</span>
              </button>
            </div>
            <Select
              value={settings.geminiModel}
              onValueChange={(geminiModel) => updateSettings({ geminiModel })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {displayedModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-medium leading-tight">{model.displayName}</span>
                      {model.displayName !== model.id && (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{model.id}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modelStatus && (
              <p
                className={cn(
                  "text-xs transition-all",
                  modelStatus.type === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500",
                )}
              >
                {modelStatus.message}
              </p>
            )}
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Google Gemini API Key
              </Label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-2xs font-semibold text-[var(--theme)] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>키 발급받기</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <Input
              type="password"
              value={settings.geminiApiKey}
              onChange={(event) => updateSettings({ geminiApiKey: event.target.value })}
              onBlur={() => {
                if (settings.geminiApiKey.trim()) {
                  void loadModels(settings.geminiApiKey);
                }
              }}
              placeholder="Google AI Studio API Key (AI 평가 필수)"
              className="h-10 text-sm"
            />
          </div>

          {/* NEIS API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                NEIS 교육행정정보 오픈 API Key
              </Label>
              <span className="text-2xs text-zinc-400">선택 사항</span>
            </div>
            <Input
              value={settings.neisApiKey}
              onChange={(event) => updateSettings({ neisApiKey: event.target.value })}
              placeholder="비워두면 NEIS 샘플 키 사용"
              className="h-10 text-sm"
            />
          </div>

          {/* 캐시 데이터 초기화 */}
          <div className="pt-3 border-t border-zinc-200/60 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  로컬 급식 및 평가 캐시 데이터
                </div>
                <div className="text-2xs text-zinc-500 dark:text-zinc-400">
                  식단이 맞지 않거나 새로고침이 필요할 때 로컬 DB 캐시를 비웁니다.
                </div>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                if (window.confirm("저장된 급식 캐시 데이터를 모두 삭제하시겠습니까?")) {
                  await clearCachedData();
                  alert("캐시 데이터가 성공적으로 삭제되었습니다.");
                }
              }}
              className="w-full font-bold text-xs cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              캐시 데이터 삭제
            </Button>
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 📱 6. 앱 정보 & 버전 (App Info & Version) */}
      {/* ========================================================================= */}
      <Card className="space-y-3 bg-gradient-to-br from-zinc-50/90 to-white dark:from-white/5 dark:to-zinc-900/40 border border-zinc-200/60 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Info className="h-4.5 w-4.5 text-[var(--theme)]" />
          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">앱 정보</h4>
        </div>

        <div className="space-y-2 rounded-2xl bg-white/60 p-4 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>급식평론가 (Yami)</span>
                <span className="rounded-md bg-[var(--theme)]/15 px-1.5 py-0.5 text-[10px] font-black text-[var(--theme)]">
                  v1.5.0
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                AI 급식 평가 및 NEIS 식단 관리 서비스
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 whitespace-nowrap">
              <Check className="h-3 w-3 stroke-[3]" /> 최신 버전
            </span>
          </div>

          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>릴리스 노트 & 오픈소스</span>
            <a
              href="https://github.com/gitzzang11/yami/releases/tag/v1.5.0"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[var(--theme)] hover:underline cursor-pointer"
            >
              <span>GitHub Release</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

