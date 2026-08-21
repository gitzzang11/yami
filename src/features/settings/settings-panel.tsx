"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, KeyRound, Moon, Palette, RefreshCw, School, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { clearCachedData } from "@/db/app-db";
import { cn } from "@/lib/utils";
import { DEFAULT_GEMINI_MODELS, fetchAvailableGeminiModels } from "@/services/gemini";
import { disableMealNotification, requestNotificationPermission, scheduleDailyMealNotification, sendTestNotification } from "@/services/notifications";
import { showNotificationToast } from "@/components/ui/toast";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, Meal } from "@/types";

type Props = {
  today?: Meal;
  review?: AiReview;
};

const colors = ["#0ea5e9", "#10b981", "#f43f5e", "#8b5cf6", "#f59e0b", "#f5f5f7"];

export function SettingsPanel({ today, review }: Props) {
  const { settings, updateSettings } = useAppStore();
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadModels(apiKeyToUse?: string) {
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
  }

  // Auto-fetch model list if API key exists and models not loaded yet
  useEffect(() => {
    if (
      settings.geminiApiKey?.trim() &&
      (!settings.availableGeminiModels || settings.availableGeminiModels.length === 0)
    ) {
      loadModels(settings.geminiApiKey);
    }
  }, [settings.geminiApiKey]);

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
    <div className="space-y-5">
      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API</CardTitle>
        <div className="space-y-2">
          <Label>Gemini API Key</Label>
          <Input
            type="password"
            value={settings.geminiApiKey}
            onChange={(event) => updateSettings({ geminiApiKey: event.target.value })}
            onBlur={() => {
              if (settings.geminiApiKey.trim()) {
                loadModels(settings.geminiApiKey);
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
              onClick={() => loadModels()}
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
