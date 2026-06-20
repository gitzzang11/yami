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

export function stripMenuNoise(value: string) {
  return value
    .replace(/<br\/?>/gi, "\n")
    .replace(/\([0-9.]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitMenu(value: string) {
  return stripMenuNoise(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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
