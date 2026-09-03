"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import type { MenuReactionType } from "@/types";

export interface MenuReactionConfig {
  emoji: MenuReactionType;
  label: string;
  pillClass: string;
  toastType: "success" | "heart" | "info" | "unheart";
  toastMessage: string;
  toastSub: string;
}

export const MENU_REACTIONS: MenuReactionConfig[] = [
  {
    emoji: "👍",
    label: "따봉",
    pillClass:
      "ring-1 ring-emerald-400 bg-emerald-50/90 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-700 shadow-emerald-500/10",
    toastType: "success",
    toastMessage: "따봉 반응 추가! 👍",
    toastSub: "오늘 이 메뉴 강력 추천!",
  },
  {
    emoji: "❤️",
    label: "하트 (최애)",
    pillClass: "highlighter-mark ring-2 ring-yellow-400 dark:ring-yellow-400/80 scale-[1.02]",
    toastType: "heart",
    toastMessage: "최애 메뉴 등록 완료! ❤️",
    toastSub: "전날 저녁(D-1)과 당일에 재치있는 알림으로 알려드릴게요!",
  },
  {
    emoji: "👎",
    label: "역따봉",
    pillClass:
      "ring-1 ring-zinc-300 bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-400 dark:ring-zinc-700 opacity-80",
    toastType: "info",
    toastMessage: "역따봉 반응 추가! 👎",
    toastSub: "다음엔 더 맛있게 나오길 기대해봐요.",
  },
  {
    emoji: "🤢",
    label: "웩",
    pillClass:
      "ring-1 ring-emerald-400/70 bg-lime-50/90 text-lime-950 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800 opacity-85",
    toastType: "info",
    toastMessage: "웩 반응 추가! 🤢",
    toastSub: "이 메뉴는 오늘 진짜 아니었어요...",
  },
];

export function getReactionConfig(reaction: MenuReactionType): MenuReactionConfig | undefined {
  return MENU_REACTIONS.find((r) => r.emoji === reaction);
}

interface MenuReactionChipProps {
  name: string;
  raw?: string;
  allergies?: number[];
  hasAllergyWarning?: boolean;
  matchedAllergies?: string[];
  currentReaction?: MenuReactionType | null;
  isFavorite?: boolean;
  onSelectReaction: (reaction: MenuReactionType | null) => void;
  size?: "sm" | "md";
}

export function MenuReactionChip({
  name,
  allergies = [],
  hasAllergyWarning = false,
  matchedAllergies = [],
  currentReaction,
  isFavorite = false,
  onSelectReaction,
  size = "sm",
}: MenuReactionChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 팝업 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const activeReaction = currentReaction || (isFavorite ? "❤️" : null);
  const activeConfig = activeReaction ? getReactionConfig(activeReaction) : undefined;
  const isHeart = activeReaction === "❤️" || isFavorite;

  const handleEmojiClick = (emoji: MenuReactionType) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
    // 이미 선택된 반응을 다시 누르면 해제
    if (activeReaction === emoji) {
      onSelectReaction(null);
    } else {
      onSelectReaction(emoji);
    }
    setIsOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    onSelectReaction(null);
    setIsOpen(false);
  };

  const sizeClasses =
    size === "md"
      ? "px-4 py-2 text-sm"
      : "px-3 py-1.5 text-xs";

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      {/* 빠른 반응 이모티콘 플로팅 팝업 (메시지 앱 스타일 Tapback Bar) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 6 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 flex items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-2xl border border-zinc-200/90 dark:bg-zinc-900/95 dark:border-zinc-700/80 backdrop-blur-xl"
            style={{
              boxShadow: "0 12px 28px -4px rgba(0, 0, 0, 0.28), 0 6px 12px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            {MENU_REACTIONS.map((item) => {
              const isSelected = activeReaction === item.emoji;
              return (
                <motion.button
                  key={item.emoji}
                  type="button"
                  whileHover={{ scale: 1.45, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleEmojiClick(item.emoji)}
                  title={`${item.label} (${item.toastSub})`}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors cursor-pointer select-none ${
                    isSelected
                      ? "bg-amber-100 ring-2 ring-amber-400 dark:bg-amber-950/60 dark:ring-amber-500 shadow-xs"
                      : "hover:bg-zinc-100 dark:hover:bg-white/10"
                  }`}
                >
                  <span>{item.emoji}</span>
                  {isSelected && (
                    <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-amber-500" />
                  )}
                </motion.button>
              );
            })}

            {activeReaction && (
              <button
                type="button"
                onClick={handleRemove}
                title="반응 해제"
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/10 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* 아래쪽 말풍선 꼬리표 화살표 */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-white/95 dark:bg-zinc-900/95 border-r border-b border-zinc-200/90 dark:border-zinc-700/80 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메뉴 칩 메인 버튼 */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen((prev) => !prev)}
        title={name}
        className={`group relative flex items-center gap-1.5 rounded-full font-bold shadow-sm whitespace-nowrap cursor-pointer select-none transition-all ${sizeClasses} ${
          isHeart
            ? "highlighter-mark ring-2 ring-yellow-400 dark:ring-yellow-400/80 scale-[1.02]"
            : activeConfig
              ? activeConfig.pillClass
              : hasAllergyWarning
                ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/50 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-800"
                : "bg-white/80 text-zinc-900 ring-1 ring-zinc-200/60 hover:bg-yellow-50/80 hover:text-amber-950 hover:ring-yellow-400/50 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-yellow-400/15"
        }`}
      >
        {/* 이모티콘 또는 알레르기 아이콘 */}
        {activeReaction ? (
          <span
            className={`text-xs shrink-0 ${
              isHeart ? "animate-pulse" : "transform transition-transform group-hover:scale-110"
            }`}
          >
            {activeReaction}
          </span>
        ) : hasAllergyWarning ? (
          <span
            className="flex items-center text-rose-600 dark:text-rose-400 shrink-0"
            title={matchedAllergies.length > 0 ? `알레르기 주의: ${matchedAllergies.join(", ")}` : "알레르기 주의"}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-0.5" />
          </span>
        ) : (
          <span className="text-2xs opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
            💬
          </span>
        )}

        <span className={isHeart ? "font-black tracking-tight" : ""}>{name}</span>

        {allergies.length > 0 && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
            ({allergies.join(".")})
          </span>
        )}

        {isHeart && (
          <span className="ml-0.5 rounded-full bg-yellow-400/60 px-1 py-0.2 text-[9px] font-black text-amber-950 dark:text-yellow-200 shrink-0">
            최애
          </span>
        )}
      </motion.button>
    </div>
  );
}
