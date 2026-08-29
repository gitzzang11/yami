"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const CRITERIA_PRESETS = [
  "🍖 고기 반찬 우선",
  "🌶️ 매콤한 맛 선호",
  "🥗 채소 비중 감소",
  "🍰 디저트 필수",
  "💪 단백질/벌크업",
  "🍜 면 요리 사랑",
  "🧀 치즈 메뉴 선호",
];

function getWeightBadge(weight: number) {
  if (weight <= 0.5) {
    return {
      label: "약하게 반영",
      className: "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400",
    };
  }
  if (weight <= 1.2) {
    return {
      label: "보통 반영",
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold",
    };
  }
  return {
    label: "🔥 최우선 반영",
    className: "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black",
  };
}

export function CriteriaEditor({ embedded = false }: { embedded?: boolean }) {
  const { criteria, addCriterion, updateCriterion, removeCriterion } = useAppStore();
  const [label, setLabel] = useState("");

  function add(customText?: string) {
    const textToAdd = (customText ?? label).trim();
    if (!textToAdd) return;
    addCriterion(textToAdd);
    if (!customText) setLabel("");
  }

  const existingLabels = criteria.map((c) => c.label.toLowerCase());

  const content = (
    <div className="space-y-4">
      <div>
        <CardTitle className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
          <SlidersHorizontal className="h-4.5 w-4.5 text-[var(--theme)]" />
          <span>나만의 커스텀 평가 기준 ({criteria.filter((c) => c.enabled).length}개 활성)</span>
        </CardTitle>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 break-keep">
          AI 비평가가 급식을 채점할 때 특별히 가산점/감점을 부여할 나만의 취향과 가중치를 설정합니다.
        </p>
      </div>

      {/* 새 기준 추가 입력창 */}
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          placeholder="예: 매운 떡볶이 선호, 과일 디저트 우대"
          className="h-10 text-sm"
        />
        <Button size="sm" onClick={() => add()} className="shrink-0 h-10 px-4 font-bold cursor-pointer">
          <Plus className="h-4 w-4 mr-1" />
          추가
        </Button>
      </div>

      {/* 추천 프리셋 태그 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>추천 인기 기준 프리셋 (클릭 시 추가)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CRITERIA_PRESETS.map((preset) => {
            const isAlreadyAdded = existingLabels.some((l) =>
              l.includes(preset.slice(2).trim().toLowerCase()),
            );
            return (
              <button
                key={preset}
                type="button"
                disabled={isAlreadyAdded}
                onClick={() => add(preset)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition cursor-pointer select-none active:scale-95 whitespace-nowrap shrink-0",
                  isAlreadyAdded
                    ? "opacity-40 cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-white/5 dark:text-zinc-500"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15",
                )}
              >
                <span>{preset}</span>
                {!isAlreadyAdded && <span className="text-[10px] font-black">+</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 기준 목록 */}
      <div className="space-y-2.5 pt-1">
        {criteria.map((criterion) => {
          const badge = getWeightBadge(criterion.weight);
          return (
            <div
              key={criterion.id}
              className={cn(
                "rounded-2xl p-3.5 border transition",
                criterion.enabled
                  ? "border-zinc-200/80 bg-white/70 shadow-xs dark:border-white/10 dark:bg-white/5"
                  : "border-zinc-200/40 bg-zinc-50/60 opacity-60 dark:border-white/5 dark:bg-black/20",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Input
                  value={criterion.label}
                  onChange={(event) => updateCriterion(criterion.id, { label: event.target.value })}
                  className="h-9 font-bold text-sm bg-transparent border-zinc-200 dark:border-white/10"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={criterion.enabled}
                    onCheckedChange={(enabled) => updateCriterion(criterion.id, { enabled })}
                    aria-label={`${criterion.label} 활성화`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCriterion(criterion.id)}
                    aria-label={`${criterion.label} 삭제`}
                    className="h-9 w-9 text-zinc-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {criterion.enabled && (
                <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-white/5">
                  <div className="flex-1">
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={[criterion.weight]}
                      onValueChange={([weight]) => updateCriterion(criterion.id, { weight })}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px]",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                    <span className="w-9 text-right text-xs font-black text-zinc-700 dark:text-zinc-300">
                      {criterion.weight.toFixed(1)}x
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <Card className="space-y-4">{content}</Card>;
}

