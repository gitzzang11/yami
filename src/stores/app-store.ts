"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppSettings, Criterion, MenuReactionType, School } from "@/types";

const defaultCriteria: Criterion[] = [
  { id: "dessert", label: "디저트 포함", weight: 1.2, enabled: true },
  { id: "drink", label: "음료 포함", weight: 0.8, enabled: true },
  { id: "meat", label: "고기 반찬 우선", weight: 1.4, enabled: true },
  { id: "fried", label: "튀김 선호", weight: 0.7, enabled: false },
  { id: "vegetable-low", label: "채소 비중 감소", weight: 0.5, enabled: false },
];

const defaultSettings: AppSettings = {
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash",
  neisApiKey: "",
  darkMode: false,
  themeColor: "#0ea5e9",
  notificationsEnabled: false,
  notificationTime: "07:30",
  userAllergies: [],
  preferredMealKind: "lunch",
  favoriteKeywords: ["치킨", "돈까스", "마라탕", "스파게티", "와플"],
  menuReactions: {},
  keywordNotificationsEnabled: false,
  criticPersona: "student",
};

type AppStore = {
  settings: AppSettings;
  criteria: Criterion[];
  hasHydrated: boolean;
  setHydrated: (value: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  toggleAllergy: (allergyId: number) => void;
  addFavoriteKeyword: (keyword: string) => void;
  removeFavoriteKeyword: (keyword: string) => void;
  toggleFavoriteKeyword: (keyword: string) => void;
  setMenuReaction: (menuName: string, reaction: MenuReactionType | null) => void;
  setSchool: (school: School) => void;
  addCriterion: (label: string) => void;
  updateCriterion: (id: string, updates: Partial<Criterion>) => void;
  removeCriterion: (id: string) => void;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      criteria: defaultCriteria,
      hasHydrated: false,
      setHydrated: (value) => set({ hasHydrated: value }),
      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),
      toggleAllergy: (allergyId) =>
        set((state) => {
          const current = state.settings.userAllergies ?? [];
          const next = current.includes(allergyId)
            ? current.filter((id) => id !== allergyId)
            : [...current, allergyId];
          return { settings: { ...state.settings, userAllergies: next } };
        }),
      addFavoriteKeyword: (keyword) =>
        set((state) => {
          const trimmed = keyword.trim();
          if (!trimmed) return state;
          const current = state.settings.favoriteKeywords ?? [];
          if (current.includes(trimmed)) return state;
          return { settings: { ...state.settings, favoriteKeywords: [...current, trimmed] } };
        }),
      removeFavoriteKeyword: (keyword) =>
        set((state) => {
          const current = state.settings.favoriteKeywords ?? [];
          return { settings: { ...state.settings, favoriteKeywords: current.filter((k) => k !== keyword) } };
        }),
      toggleFavoriteKeyword: (keyword) =>
        set((state) => {
          const trimmed = keyword.trim();
          if (!trimmed) return state;
          const current = state.settings.favoriteKeywords ?? [];
          const next = current.includes(trimmed)
            ? current.filter((k) => k !== trimmed)
            : [...current, trimmed];
          return { settings: { ...state.settings, favoriteKeywords: next } };
        }),
      setMenuReaction: (menuName, reaction) =>
        set((state) => {
          const cleanName = menuName.replace(/\([0-9.]+\)/g, "").trim();
          if (!cleanName) return state;

          const currentReactions = { ...(state.settings.menuReactions ?? {}) };
          const currentFavorites = [...(state.settings.favoriteKeywords ?? [])];

          // 이미 같은 반응이 선택되어 있거나 reaction이 null인 경우 -> 반응 해제
          if (!reaction || currentReactions[cleanName] === reaction) {
            delete currentReactions[cleanName];
            const nextFavorites = currentFavorites.filter(
              (k) =>
                k.toLowerCase() !== cleanName.toLowerCase() &&
                !cleanName.toLowerCase().includes(k.toLowerCase()) &&
                !k.toLowerCase().includes(cleanName.toLowerCase()),
            );
            return {
              settings: {
                ...state.settings,
                menuReactions: currentReactions,
                favoriteKeywords: nextFavorites,
              },
            };
          }

          // 새로운 반응 적용
          currentReactions[cleanName] = reaction;
          let nextFavorites = currentFavorites;

          if (reaction === "❤️") {
            // 하트인 경우 최애 키워드로도 등록
            if (!nextFavorites.some((k) => k.toLowerCase() === cleanName.toLowerCase())) {
              nextFavorites = [...nextFavorites, cleanName];
            }
          } else {
            // 다른 반응(👍, 👎, 😢 등)인 경우 최애 키워드 목록에서는 제외
            nextFavorites = nextFavorites.filter(
              (k) =>
                k.toLowerCase() !== cleanName.toLowerCase() &&
                !cleanName.toLowerCase().includes(k.toLowerCase()) &&
                !k.toLowerCase().includes(cleanName.toLowerCase()),
            );
          }

          return {
            settings: {
              ...state.settings,
              menuReactions: currentReactions,
              favoriteKeywords: nextFavorites,
            },
          };
        }),
      setSchool: (school) =>
        set((state) => ({ settings: { ...state.settings, selectedSchool: school } })),
      addCriterion: (label) =>
        set((state) => ({
          criteria: [
            ...state.criteria,
            {
              id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `crit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              label: label.trim(),
              weight: 1,
              enabled: true,
            },
          ],
        })),
      updateCriterion: (id, updates) =>
        set((state) => ({
          criteria: state.criteria.map((criterion) =>
            criterion.id === id ? { ...criterion, ...updates } : criterion,
          ),
        })),
      removeCriterion: (id) =>
        set((state) => ({
          criteria: state.criteria.filter((criterion) => criterion.id !== id),
        })),
    }),
    {
      name: "meal-critic-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
