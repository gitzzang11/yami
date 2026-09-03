import { describe, expect, it } from "vitest";
import {
  USER_REACTION_CONFIG,
  calculateMealAwards,
  calculateTasteInsights,
} from "@/services/feedback";
import type { AiReview, Meal, UserMealFeedback } from "@/types";

describe("User Feedback & Meal Awards Tests", () => {
  const mockMeal1: Meal = {
    id: "7010057-20260825-lunch",
    officeCode: "B10",
    schoolCode: "7010057",
    schoolName: "서울고등학교",
    date: "20260825",
    kind: "lunch",
    kindName: "중식",
    menu: ["차수수밥", "마라탕", "꿔바로우", "수제와플"],
    rawMenu: "차수수밥\n마라탕\n꿔바로우\n수제와플",
    calories: "920 kcal",
    updatedAt: Date.now(),
  };

  const mockMeal2: Meal = {
    id: "7010057-20260826-lunch",
    officeCode: "B10",
    schoolCode: "7010057",
    schoolName: "서울고등학교",
    date: "20260826",
    kind: "lunch",
    kindName: "중식",
    menu: ["현미밥", "시래기된장국", "도토리묵무침", "총각김치"],
    rawMenu: "현미밥\n시래기된장국\n도토리묵무침\n총각김치",
    calories: "520 kcal",
    updatedAt: Date.now(),
  };

  const mockMeal3: Meal = {
    id: "7010057-20260827-lunch",
    officeCode: "B10",
    schoolCode: "7010057",
    schoolName: "서울고등학교",
    date: "20260827",
    kind: "lunch",
    kindName: "중식",
    menu: ["치즈돈까스", "크림스파게티", "치킨가라아게", "마늘빵"],
    rawMenu: "치즈돈까스\n크림스파게티\n치킨가라아게\n마늘빵",
    calories: "1050 kcal",
    updatedAt: Date.now(),
  };

  const mockReviews: AiReview[] = [
    {
      id: "rev-1",
      mealId: mockMeal1.id,
      schoolCode: "7010057",
      date: "20260825",
      mealKind: "lunch",
      model: "gemini-3.5-flash",
      totalScore: 94,
      oneLine: "마라탕과 꿔바로우의 환상 조합!",
      detail: "완벽한 중식 구성입니다.",
      scores: [{ name: "맛의 조화", score: 95, max: 100, comment: "훌륭함" }],
      createdAt: 1000,
    },
    {
      id: "rev-2",
      mealId: mockMeal2.id,
      schoolCode: "7010057",
      date: "20260826",
      mealKind: "lunch",
      model: "gemini-3.5-flash",
      totalScore: 62,
      oneLine: "너무 소박하고 담백한 식단",
      detail: "육류가 부족합니다.",
      scores: [{ name: "맛의 조화", score: 60, max: 100, comment: "아쉬움" }],
      createdAt: 2000,
    },
  ];

  const mockFeedbacks: UserMealFeedback[] = [
    {
      id: "fb-1",
      mealId: mockMeal1.id,
      schoolCode: "7010057",
      date: "20260825",
      mealKind: "lunch",
      score: 100,
      reaction: "delicious",
      createdAt: 1500,
    },
    {
      id: "fb-2",
      mealId: mockMeal2.id,
      schoolCode: "7010057",
      date: "20260826",
      mealKind: "lunch",
      score: 40,
      reaction: "bad",
      createdAt: 2500,
    },
  ];

  it("should have all 6 reaction configurations defined", () => {
    const reactions = ["delicious", "good", "soso", "bad", "spicy", "little"] as const;
    reactions.forEach((r) => {
      const cfg = USER_REACTION_CONFIG[r];
      expect(cfg).toBeDefined();
      expect(cfg.label).toBeTruthy();
      expect(cfg.emoji).toBeTruthy();
      expect(cfg.defaultScore).toBeGreaterThan(0);
    });
  });

  it("should calculate Legend Meal and Disaster Meal awards", () => {
    const awards = calculateMealAwards(
      [mockMeal1, mockMeal2, mockMeal3],
      mockReviews,
      mockFeedbacks,
      ["돈까스", "스파게티", "치킨"],
    );

    const legendAward = awards.find((a) => a.type === "legend");
    expect(legendAward).toBeDefined();
    expect(legendAward?.date).toBe("20260825");

    const worstAward = awards.find((a) => a.type === "worst");
    expect(worstAward).toBeDefined();
    expect(worstAward?.date).toBe("20260826");

    const calorieAward = awards.find((a) => a.type === "calorie_champion");
    expect(calorieAward).toBeDefined();
    expect(calorieAward?.date).toBe("20260827");
    expect(calorieAward?.badge).toContain("1050 kcal");

    const favoritePeakAward = awards.find((a) => a.type === "favorite_peak");
    expect(favoritePeakAward).toBeDefined();
    expect(favoritePeakAward?.date).toBe("20260827");
  });

  it("should calculate Taste Match % and Category statistics", () => {
    const insights = calculateTasteInsights(
      [mockMeal1, mockMeal2, mockMeal3],
      mockReviews,
      mockFeedbacks,
    );

    expect(insights.comparedCount).toBe(2);
    expect(insights.matchPercentage).toBeGreaterThanOrEqual(10);
    expect(insights.matchPercentage).toBeLessThanOrEqual(100);

    const meatCat = insights.categories.find((c) => c.name === "육류/단백질");
    expect(meatCat).toBeDefined();
    expect(meatCat?.count).toBeGreaterThan(0);

    const friedCat = insights.categories.find((c) => c.name === "바삭 튀김류");
    expect(friedCat).toBeDefined();
    expect(friedCat?.count).toBeGreaterThan(0);
  });

  it("should configure messaging app 4 quick menu reactions (thumbs up, heart, thumbs down, barf) properly", async () => {
    const { getReactionConfig, MENU_REACTIONS } = await import("@/components/menu-reaction-chip");

    expect(MENU_REACTIONS.length).toBe(4);

    const thumbsUp = getReactionConfig("👍");
    expect(thumbsUp).toBeDefined();
    expect(thumbsUp?.label).toBe("따봉");
    expect(thumbsUp?.toastType).toBe("success");

    const heart = getReactionConfig("❤️");
    expect(heart).toBeDefined();
    expect(heart?.label).toContain("하트");
    expect(heart?.pillClass).toContain("highlighter-mark");

    const thumbsDown = getReactionConfig("👎");
    expect(thumbsDown).toBeDefined();
    expect(thumbsDown?.label).toBe("역따봉");

    const barf = getReactionConfig("🤢");
    expect(barf).toBeDefined();
    expect(barf?.label).toBe("웩");
    expect(barf?.toastMessage).toContain("웩");
  });
});
