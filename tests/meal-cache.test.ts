import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meal, School } from "@/types";

const cache = vi.hoisted(() => ({ meals: [] as Meal[] }));
vi.mock("@/db/app-db", () => ({
  db: {
    transaction: async (_mode: string, _table: unknown, work: () => Promise<void>) => work(),
    meals: {
      where: () => ({
        between: ([school, from]: string[], [, to]: string[]) => {
          const inRange = (m: Meal) => m.schoolCode === school && m.date >= from && m.date <= to;
          return {
            delete: async () => { cache.meals = cache.meals.filter((m) => !inRange(m)); },
            toArray: async () => cache.meals.filter(inRange),
          };
        },
      }),
      bulkPut: async (meals: Meal[]) => { cache.meals.push(...meals); },
    },
  },
}));
import { getMealsByRange } from "@/services/neis";

const school: School = { id: "a", officeCode: "B10", schoolCode: "a", name: "테스트학교", address: "", kind: "고등학교" };
function meal(date: string, schoolCode = "a"): Meal {
  return { id: `${schoolCode}-${date}`, officeCode: "B10", schoolCode, schoolName: "테스트학교", date,
    kind: "lunch", kindName: "중식", menu: ["돈까스"], rawMenu: "돈까스", updatedAt: 0 };
}

describe("meal cache refresh for notification eligibility", () => {
  beforeEach(() => {
    cache.meals = [meal("20261007"), meal("20261008"), meal("20261006"), meal("20261007", "b")];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("removes outdated cached meals when NEIS reports no meals, preserving other schools and dates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ RESULT: { CODE: "INFO-200" } }) }));
    expect(await getMealsByRange(school, new Date(2026, 9, 7), new Date(2026, 9, 8))).toEqual([]);
    expect(cache.meals.map((m) => m.id)).toEqual(["a-20261006", "b-20261007"]);
  });

  it("removes a cancelled meal when only the next day's meal remains in the refreshed range", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mealServiceDietInfo: [
      { head: [] }, { row: [{ ATPT_OFCDC_SC_CODE: "B10", SD_SCHUL_CODE: "a", MLSV_YMD: "20261008", MMEAL_SC_NM: "중식", DDISH_NM: "쌀밥" }] },
    ] }) }));
    const meals = await getMealsByRange(school, new Date(2026, 9, 7), new Date(2026, 9, 8));
    expect(meals.map((m) => m.date)).toEqual(["20261008"]);
    expect(cache.meals.some((m) => m.schoolCode === "a" && m.date === "20261007")).toBe(false);
    expect(cache.meals.find((m) => m.date === "20261008")?.menu).toEqual(["쌀밥"]);
  });

  it("preserves cached meals when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const meals = await getMealsByRange(school, new Date(2026, 9, 7), new Date(2026, 9, 8));
    expect(meals.map((m) => m.date)).toEqual(["20261007", "20261008"]);
    expect(cache.meals).toHaveLength(4);
  });
});
