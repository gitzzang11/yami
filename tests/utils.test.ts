import { describe, expect, it } from "vitest";
import {
  ALLERGIES_MAP,
  formatKoreanDate,
  parseMenuWithAllergies,
  parseNutritionInfo,
  scoreTone,
  yyyymmdd,
} from "@/lib/utils";

describe("Utils & Parser Tests", () => {
  it("should format Date to YYYYMMDD string correctly", () => {
    const d = new Date(2026, 7, 25); // month 7 is August (0-indexed)
    expect(yyyymmdd(d)).toBe("20260825");
  });

  it("should format Korean Date correctly", () => {
    const d = new Date(2026, 7, 25);
    const formatted = formatKoreanDate(d);
    expect(formatted).toContain("8월 25일");
  });

  it("should correctly parse menu with allergy numbers in parentheses", () => {
    const raw = "친환경차수수밥<br/>돈육김치찌개 (9.10.)<br/>치즈돈까스/소스 (1.2.5.6.10.12.13.)<br/>깍두기 (9.)";
    const items = parseMenuWithAllergies(raw);

    expect(items.length).toBe(4);
    expect(items[0].name).toBe("친환경차수수밥");
    expect(items[0].allergies).toEqual([]);

    expect(items[1].name).toBe("돈육김치찌개");
    expect(items[1].allergies).toEqual([9, 10]);

    expect(items[2].name).toBe("치즈돈까스/소스");
    expect(items[2].allergies).toEqual([1, 2, 5, 6, 10, 12, 13]);

    expect(items[3].name).toBe("깍두기");
    expect(items[3].allergies).toEqual([9]);
  });

  it("should map allergy IDs to correct Korean names", () => {
    expect(ALLERGIES_MAP[1]).toBe("난류");
    expect(ALLERGIES_MAP[2]).toBe("우유");
    expect(ALLERGIES_MAP[5]).toBe("대두");
    expect(ALLERGIES_MAP[6]).toBe("밀");
    expect(ALLERGIES_MAP[10]).toBe("돼지고기");
  });

  it("should correctly parse nutritional values & macros", () => {
    const ntrInfo = "탄수화물(g) : 105.2<br/>단백질(g) : 38.4<br/>지방(g) : 22.1<br/>비타민A(R.E) : 230.5";
    const calInfo = "780.5 Kcal";

    const parsed = parseNutritionInfo(ntrInfo, calInfo);
    expect(parsed.calories).toBe(780.5);
    expect(parsed.carbs).toBe(105.2);
    expect(parsed.protein).toBe(38.4);
    expect(parsed.fat).toBe(22.1);
    expect(parsed.items.length).toBeGreaterThan(0);
  });

  it("should return appropriate tone, label, and emoji for scores", () => {
    const high = scoreTone(95);
    expect(high.label).toBe("매우 훌륭함");
    expect(high.emoji).toBe("🏆");

    const good = scoreTone(85);
    expect(good.label).toBe("좋음");
    expect(good.emoji).toBe("😋");

    const average = scoreTone(70);
    expect(average.label).toBe("보통");
    expect(average.emoji).toBe("🙂");

    const bad = scoreTone(45);
    expect(bad.label).toBe("충격적");
    expect(bad.emoji).toBe("🫠");
  });
});
