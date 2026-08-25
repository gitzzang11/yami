import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function yyyymmdd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export const ALLERGIES_MAP: Record<number, string> = {
  1: "난류",
  2: "우유",
  3: "메밀",
  4: "땅콩",
  5: "대두",
  6: "밀",
  7: "고등어",
  8: "게",
  9: "새우",
  10: "돼지고기",
  11: "복숭아",
  12: "토마토",
  13: "아황산염",
  14: "호두",
  15: "닭고기",
  16: "쇠고기",
  17: "오징어",
  18: "조개류",
  19: "잣",
};

export type ParsedMenuItem = {
  name: string;
  allergies: number[];
  raw: string;
};

export function parseMenuWithAllergies(rawMenu: string): ParsedMenuItem[] {
  if (!rawMenu) return [];
  const lines = rawMenu.replace(/<br\/?>/gi, "\n").split(/\n|,/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // Extract allergy numbers like (1.2.5.6) or (1,2,5,6) or (13.) or 1.2.5.
      const match = trimmed.match(/\(([\d\s.,]+)\)/);
      const allergies: number[] = [];
      if (match && match[1]) {
        const nums = match[1].split(/[.,\s]+/).filter(Boolean).map(Number);
        for (const num of nums) {
          if (!isNaN(num) && num >= 1 && num <= 19) {
            allergies.push(num);
          }
        }
      }

      const cleanName = trimmed
        .replace(/\([\d\s.,]+\)/g, "")
        .replace(/[0-9.]+\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();

      return {
        name: cleanName || trimmed,
        allergies: Array.from(new Set(allergies)).sort((a, b) => a - b),
        raw: trimmed,
      };
    })
    .filter((item): item is ParsedMenuItem => item !== null && item.name.length > 0);
}

export function stripMenuNoise(value: string) {
  return parseMenuWithAllergies(value)
    .map((item) => item.name)
    .join("\n");
}

export function splitMenu(value: string) {
  return parseMenuWithAllergies(value).map((item) => item.name);
}

export type ParsedNutrition = {
  carbs?: number;
  protein?: number;
  fat?: number;
  calories?: number;
  sodium?: number;
  items: { label: string; value: string }[];
};

export function parseNutritionInfo(nutritionStr?: string, caloriesStr?: string): ParsedNutrition {
  const result: ParsedNutrition = { items: [] };
  if (caloriesStr) {
    const calMatch = caloriesStr.match(/([\d,.]+)\s*k?cal/i) || caloriesStr.match(/([\d,.]+)/);
    if (calMatch) {
      result.calories = parseFloat(calMatch[1].replace(/,/g, ""));
    }
  }

  if (!nutritionStr) return result;

  const lines = nutritionStr
    .replace(/<br\/?>/gi, "\n")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const label = parts[0].trim();
      const value = parts.slice(1).join(":").trim();
      result.items.push({ label, value });

      const numMatch = value.match(/([\d,.]+)/);
      const num = numMatch ? parseFloat(numMatch[1].replace(/,/g, "")) : undefined;

      if (num !== undefined && !isNaN(num)) {
        if (label.includes("탄수화물")) result.carbs = num;
        else if (label.includes("단백질")) result.protein = num;
        else if (label.includes("지방") && !label.includes("포화") && !label.includes("트랜스")) result.fat = num;
        else if (label.includes("나트륨")) result.sodium = num;
      }
    } else {
      result.items.push({ label: "정보", value: line });
    }
  }

  return result;
}

export function scoreTone(score?: number) {
  if (score === undefined) {
    return {
      label: "평가 대기",
      emoji: "✨",
      className: "from-zinc-400 to-slate-500",
      textClassName: "text-zinc-500 dark:text-zinc-300",
    };
  }
  if (score >= 90) {
    return {
      label: "매우 훌륭함",
      emoji: "🏆",
      className: "from-emerald-400 to-cyan-500",
      textClassName: "text-emerald-600 dark:text-emerald-300",
    };
  }
  if (score >= 80) {
    return {
      label: "좋음",
      emoji: "😋",
      className: "from-sky-400 to-indigo-500",
      textClassName: "text-sky-600 dark:text-sky-300",
    };
  }
  if (score >= 70) {
    return {
      label: "보통",
      emoji: "🙂",
      className: "from-amber-300 to-orange-400",
      textClassName: "text-amber-600 dark:text-amber-300",
    };
  }
  if (score >= 60) {
    return {
      label: "아쉬움",
      emoji: "😐",
      className: "from-orange-400 to-rose-500",
      textClassName: "text-orange-600 dark:text-orange-300",
    };
  }
  return {
    label: "충격적",
    emoji: "🫠",
    className: "from-rose-500 to-red-700",
    textClassName: "text-rose-600 dark:text-rose-300",
  };
}
