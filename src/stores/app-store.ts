"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppSettings, Criterion, School } from "@/types";

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
};

type AppStore = {
  settings: AppSettings;
  criteria: Criterion[];
  hasHydrated: boolean;
  setHydrated: (value: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  toggleAllergy: (allergyId: number) => void;
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
