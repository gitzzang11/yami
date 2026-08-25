import { describe, expect, it } from "vitest";
import { isHoliday } from "@/services/notifications";

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
});
