"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/app-store";

export function CriteriaEditor() {
  const { criteria, addCriterion, updateCriterion, removeCriterion } = useAppStore();
  const [label, setLabel] = useState("");

  function add() {
    if (!label.trim()) return;
    addCriterion(label);
    setLabel("");
  }

  return (
    <Card className="space-y-4">
      <CardTitle>커스텀 평가 기준</CardTitle>
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          placeholder="예: 매운 메뉴 선호"
        />
        <Button size="icon" onClick={add} aria-label="평가 기준 추가">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <div className="space-y-3">
        {criteria.map((criterion) => (
          <div key={criterion.id} className="rounded-3xl bg-white/64 p-4 ring-1 ring-zinc-200 dark:bg-white/10 dark:ring-white/10">
            <div className="flex items-center gap-3">
              <Input
                value={criterion.label}
                onChange={(event) => updateCriterion(criterion.id, { label: event.target.value })}
                className="h-10"
              />
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
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[criterion.weight]}
                onValueChange={([weight]) => updateCriterion(criterion.id, { weight })}
              />
              <span className="w-12 text-right text-sm font-black">{criterion.weight.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
