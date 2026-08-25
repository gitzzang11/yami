"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, Check, KeyRound, Moon, Palette, Plus, RefreshCw, School, Sparkles, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { clearCachedData, db } from "@/db/app-db";
import { ALLERGIES_MAP, cn, yyyymmdd } from "@/lib/utils";
import { CRITIC_PERSONAS, DEFAULT_GEMINI_MODELS, fetchAvailableGeminiModels } from "@/services/gemini";
import { disableMealNotification, requestNotificationPermission, scheduleDailyMealNotification, scheduleKeywordMealNotifications, sendTestKeywordNotification, sendTestNotification } from "@/services/notifications";
import { showNotificationToast } from "@/components/ui/toast";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, Meal } from "@/types";

type Props = {
  today?: Meal;
  review?: AiReview;
};

const colors = ["#0ea5e9", "#10b981", "#f43f5e", "#8b5cf6", "#f59e0b", "#f5f5f7"];
const POPULAR_KEYWORD_PRESETS = ["치킨", "돈까스", "마라탕", "스파게티", "와플", "떡볶이", "햄버거", "피자", "삼겹살", "우동"];

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

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    addFavoriteKeyword(newKeyword.trim());
    setNewKeyword("");
  };

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

  const loadModels = useCallback(async (apiKeyToUse?: string) => {
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
  }, [settings.geminiApiKey, updateSettings]);

  // Safely auto-fetch model list once on mount if API key exists and models are empty
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

  const userAllergies = settings.userAllergies ?? [];

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API 설정</CardTitle>
        <div className="space-y-2">
          <Label>Gemini API Key</Label>
          <Input
            type="password"
            value={settings.geminiApiKey}
            onChange={(event) => updateSettings({ geminiApiKey: event.target.value })}
            onBlur={() => {
              if (settings.geminiApiKey.trim()) {
                void loadModels(settings.geminiApiKey);
              }
            }}
            placeholder="Google AI Studio API Key"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Gemini 모델</Label>
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
          <Select value={settings.geminiModel} onValueChange={(geminiModel) => updateSettings({ geminiModel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        <div className="space-y-2">
          <Label>NEIS API Key</Label>
          <Input
            value={settings.neisApiKey}
            onChange={(event) => updateSettings({ neisApiKey: event.target.value })}
            placeholder="비워두면 NEIS 샘플 키 사용"
          />
        </div>
      </Card>

      {/* AI 비평가 페르소나 설정 */}
      <Card className="space-y-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--theme)]" />
            AI 비평가 페르소나
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            원하는 비평가를 선택하세요. 말투와 평가 시각, 한줄평 스타일이 완전히 달라집니다.
          </p>
        </div>

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
                    <span className="text-2xl">{persona.icon}</span>
                    <span className="font-black text-sm text-zinc-900 dark:text-white">
                      {persona.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 rounded-full bg-[var(--theme)] px-2 py-0.5 text-[10px] font-black text-white">
                      <Check className="h-3 w-3 stroke-[3]" /> 선택됨
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                  {persona.shortDesc}
                </p>
                <div className="mt-2 rounded-xl bg-zinc-100/80 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 dark:bg-black/30 dark:text-zinc-300 italic">
                  &ldquo;{persona.sampleQuote}&rdquo;
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 알레르기 안심 설정 */}
      <Card className="space-y-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            알레르기 안심 알림
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            주의해야 할 알레르기를 선택하세요. 급식 메뉴에 포함 시 경고 표시가 나타납니다.
          </p>
        </div>
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
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer select-none active:scale-95",
                  isChecked
                    ? "bg-[var(--theme)] text-white shadow-sm ring-1 ring-[var(--theme)]"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15",
                )}
              >
                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                <span>{num}. {name}</span>
              </button>
            );
          })}
        </div>
        {userAllergies.length > 0 && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ 총 {userAllergies.length}개의 알레르기 항목을 감지 중입니다.
          </p>
        )}
      </Card>

      {/* 최애 메뉴 (밥도둑) 키워드 알림 설정 */}
      <Card className="space-y-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            최애 메뉴 (밥도둑) 알림
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            좋아하는 메뉴를 등록하면 급식에 나오는 날 아침에 알림을 보내드립니다.
          </p>
        </div>

        {/* 알림 활성화 스위치 */}
        <div className="flex items-center justify-between rounded-3xl bg-white/60 p-4 dark:bg-white/10">
          <div>
            <div className="font-bold text-sm">최애 메뉴 출몰 알림</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">식단에 등록된 키워드 등장 시 알림</div>
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

        {/* 키워드 직접 추가 입력창 */}
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddKeyword();
            }}
            placeholder="예: 마라탕, 뿌링클, 꿔바로우"
            className="h-10 text-sm"
          />
          <Button size="sm" onClick={handleAddKeyword} className="shrink-0 h-10 px-4">
            <Plus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </div>

        {/* 추천 인기 밥도둑 프리셋 태그 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            추천 인기 키워드
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
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer select-none active:scale-95",
                    isSelected
                      ? "bg-amber-500/20 text-amber-800 ring-1 ring-amber-400 dark:bg-amber-400/20 dark:text-amber-200 dark:ring-amber-500/50"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10",
                  )}
                >
                  <span>{isSelected ? "⭐" : "+"}</span>
                  <span>{preset}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 현재 등록된 키워드 목록 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            등록된 키워드 ({favoriteKeywords.length}개)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {favoriteKeywords.length > 0 ? (
              favoriteKeywords.map((kw) => (
                <span
                  key={kw}
                  className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-1 text-xs font-black text-amber-900 ring-1 ring-amber-300 dark:text-amber-200 dark:ring-amber-500/40"
                >
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => removeFavoriteKeyword(kw)}
                    className="ml-0.5 rounded-full p-0.5 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 cursor-pointer"
                    aria-label={`${kw} 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-xs text-zinc-400">등록된 키워드가 없습니다. 위에서 추가해 보세요!</p>
            )}
          </div>
        </div>

        {/* 다가오는 최애 메뉴 미리보기 */}
        {upcomingFavorites.length > 0 && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>다가오는 최애 급식 포착! ({upcomingFavorites.length}일)</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {upcomingFavorites.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs shadow-2xs dark:bg-zinc-900/80"
                >
                  <span className="font-bold text-zinc-700 dark:text-zinc-200">{item.dateStr}</span>
                  <span className="font-black text-amber-600 dark:text-amber-300 truncate max-w-[180px]">
                    {item.matchedMenu}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="secondary"
          onClick={() => {
            const firstKw = favoriteKeywords[0] || "치킨";
            void sendTestKeywordNotification(firstKw, `${firstKw} 특식 세트`);
          }}
          className="w-full"
        >
          <Bell className="h-4 w-4" />
          최애 메뉴 알림 테스트
        </Button>
      </Card>

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> 알림</CardTitle>
        <div className="flex items-center justify-between rounded-3xl bg-white/60 p-4 dark:bg-white/10">
          <div>
            <div className="font-bold">매일 급식 알림</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">오늘의 급식, AI 점수, 한줄평</div>
          </div>
          <Switch checked={settings.notificationsEnabled} onCheckedChange={toggleNotifications} />
        </div>
        <div className="space-y-2">
          <Label>알림 시간</Label>
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
          />
        </div>
        <Button variant="secondary" onClick={() => sendTestNotification(today, review)} className="w-full">
          <BellOff className="h-4 w-4" />
          테스트 알림
        </Button>
      </Card>

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> 화면</CardTitle>
        <div className="flex items-center justify-between rounded-3xl bg-white/60 p-4 dark:bg-white/10">
          <div className="flex items-center gap-2 font-bold"><Moon className="h-4 w-4" /> 다크모드</div>
          <Switch checked={settings.darkMode} onCheckedChange={(darkMode) => updateSettings({ darkMode })} />
        </div>
        <div className="grid grid-cols-6 gap-2">
          {colors.map((themeColor) => (
            <button
              key={themeColor}
              aria-label={`${themeColor} 테마 선택`}
              onClick={() => updateSettings({ themeColor })}
              className="h-12 rounded-2xl border border-zinc-200 dark:border-white/10 ring-2 ring-offset-2 ring-offset-transparent transition cursor-pointer"
              style={{
                backgroundColor: themeColor,
                boxShadow: settings.themeColor === themeColor ? `0 0 0 3px ${themeColor}44` : undefined,
              }}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> 데이터</CardTitle>
        <Button variant="secondary" onClick={() => updateSettings({ selectedSchool: undefined })} className="w-full">
          <School className="h-4 w-4" />
          학교 변경
        </Button>
        <Button variant="destructive" onClick={() => clearCachedData()} className="w-full">
          <Trash2 className="h-4 w-4" />
          캐시 삭제
        </Button>
      </Card>
    </div>
  );
}
