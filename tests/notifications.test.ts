import { describe, expect, it } from "vitest";
import { formatNotificationContent, isHoliday } from "@/services/notifications";
import type { AiReview, Meal } from "@/types";

describe("Notifications & Holiday Logic Tests", () => {
  it("should recognize fixed solar holidays", () => {
    // 신정 (1월 1일)
    expect(isHoliday(new Date(2026, 0, 1))).toBe(true);
    // 삼일절 (3월 1일)
    expect(isHoliday(new Date(2026, 2, 1))).toBe(true);
    // 어린이날 (5월 5일)
    expect(isHoliday(new Date(2026, 4, 5))).toBe(true);
    // 광복절 (8월 15일)
    expect(isHoliday(new Date(2026, 7, 15))).toBe(true);
    // 성탄절 (12월 25일)
    expect(isHoliday(new Date(2026, 11, 25))).toBe(true);
  });

  it("should recognize 2026 variable holidays & alternative holidays", () => {
    // 2026년 3월 2일 삼일절 대체공휴일
    expect(isHoliday(new Date(2026, 2, 2))).toBe(true);
    // 2026년 8월 17일 광복절 대체공휴일
    expect(isHoliday(new Date(2026, 7, 17))).toBe(true);
    // 2026년 10월 5일 개천절 대체공휴일
    expect(isHoliday(new Date(2026, 9, 5))).toBe(true);
  });

  it("should recognize normal school days as non-holidays", () => {
    // 2026년 8월 25일 (화요일 평일)
    expect(isHoliday(new Date(2026, 7, 25))).toBe(false);
    // 2026년 9월 1일 (화요일 평일)
    expect(isHoliday(new Date(2026, 8, 1))).toBe(false);
  });

  it("should format notification with complete meal menu without cutting off after 4 items", () => {
    const fullMeal: Meal = {
      id: "meal-1",
      officeCode: "B10",
      schoolCode: "7010057",
      schoolName: "테스트고등학교",
      date: "20260828",
      kind: "lunch",
      kindName: "중식",
      menu: [
        "찰보리밥",
        "소고기미역국",
        "수제치즈돈까스",
        "골뱅이소면무침",
        "배추김치",
        "샤인머스캣",
        "유기농우유",
      ],
      rawMenu: "찰보리밥\n소고기미역국\n수제치즈돈까스\n골뱅이소면무침\n배추김치\n샤인머스캣\n유기농우유",
      calories: "820 kcal",
      updatedAt: Date.now(),
    };

    const review: AiReview = {
      id: "rev-1",
      mealId: "meal-1",
      schoolCode: "7010057",
      date: "20260828",
      model: "gemini-3.5-flash",
      persona: "paik",
      personaName: "백종원 셰프",
      totalScore: 95,
      oneLine: "돈까스 바삭하고 소스 불맛 제대로유!",
      detail: "완벽한 조화입니다.",
      scores: [],
      createdAt: Date.now(),
    };

    const { title, body } = formatNotificationContent(fullMeal, review);

    expect(title).toBe("오늘의 중식 (95점)");
    // 모든 7개 메뉴 항목이 누락 없이 전부 포함되어 있는지 검증
    expect(body).toContain("찰보리밥");
    expect(body).toContain("소고기미역국");
    expect(body).toContain("수제치즈돈까스");
    expect(body).toContain("골뱅이소면무침");
    expect(body).toContain("배추김치");
    expect(body).toContain("샤인머스캣");
    expect(body).toContain("유기농우유");
    expect(body).toContain("[820 kcal]");
    expect(body).toContain('· "돈까스 바삭하고 소스 불맛 제대로유!"');
  });

  it("should handle empty or undefined meal gracefully", () => {
    const { title, body } = formatNotificationContent(undefined);
    expect(title).toBe("오늘의 급식");
    expect(body).toBe("급식을 확인하고 AI 평가를 받아보세요.");
  });
});
