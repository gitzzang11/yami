import { addDays } from "date-fns";
import { db } from "@/db/app-db";
import { splitMenu, yyyymmdd } from "@/lib/utils";
import type { Meal, NeisMealRow, School } from "@/types";

const BASE_URL = "https://open.neis.go.kr/hub";

type NeisSchoolRow = {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  ORG_RDNMA?: string;
  SCHUL_KND_SC_NM?: string;
};

function neisKey(apiKey?: string) {
  return apiKey?.trim() || "sample";
}

async function fetchNeis<T>(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${BASE_URL}/${path}`);
  Object.entries({ Type: "json", pIndex: 1, pSize: 100, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("NEIS API 연결에 실패했습니다.");
  }
  const data = await response.json();
  if (data.RESULT?.CODE && data.RESULT.CODE !== "INFO-000") {
    throw new Error(data.RESULT.MESSAGE ?? "NEIS API 오류가 발생했습니다.");
  }
  return data as T;
}

export async function searchSchools(query: string, apiKey?: string): Promise<School[]> {
  if (query.trim().length < 2) {
    return [];
  }
  const data = await fetchNeis<{ schoolInfo?: [{ head: unknown }, { row: NeisSchoolRow[] }] }>(
    "schoolInfo",
    { KEY: neisKey(apiKey), SCHUL_NM: query.trim() },
  );
  const rows = data.schoolInfo?.[1]?.row ?? [];
  const schools = rows.map((row) => ({
    id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`,
    officeCode: row.ATPT_OFCDC_SC_CODE,
    schoolCode: row.SD_SCHUL_CODE,
    name: row.SCHUL_NM,
    address: row.ORG_RDNMA ?? "",
    kind: row.SCHUL_KND_SC_NM ?? "학교",
  }));
  await db.schools.bulkPut(schools);
  return schools;
}

function mealKind(kindName: string): Meal["kind"] {
  if (kindName.includes("조식")) return "breakfast";
  if (kindName.includes("석식")) return "dinner";
  return "lunch";
}

function toMeal(row: NeisMealRow, fallbackSchool: School): Meal {
  const kind = mealKind(row.MMEAL_SC_NM);
  return {
    id: `${row.SD_SCHUL_CODE}-${row.MLSV_YMD}-${kind}`,
    officeCode: row.ATPT_OFCDC_SC_CODE,
    schoolCode: row.SD_SCHUL_CODE,
    schoolName: row.SCHUL_NM || fallbackSchool.name,
    date: row.MLSV_YMD,
    kind,
    kindName: row.MMEAL_SC_NM,
    rawMenu: row.DDISH_NM,
    menu: splitMenu(row.DDISH_NM),
    calories: row.CAL_INFO,
    nutrition: row.NTR_INFO,
    origin: row.ORPLC_INFO,
    updatedAt: Date.now(),
  };
}

export async function getMealsByRange(
  school: School,
  from: Date,
  to: Date,
  apiKey?: string,
): Promise<Meal[]> {
  const start = yyyymmdd(from);
  const end = yyyymmdd(to);
  try {
    const data = await fetchNeis<{ mealServiceDietInfo?: [{ head: unknown }, { row: NeisMealRow[] }] }>(
      "mealServiceDietInfo",
      {
        KEY: neisKey(apiKey),
        ATPT_OFCDC_SC_CODE: school.officeCode,
        SD_SCHUL_CODE: school.schoolCode,
        MLSV_FROM_YMD: start,
        MLSV_TO_YMD: end,
      },
    );
    const meals = (data.mealServiceDietInfo?.[1]?.row ?? [])
      .map((row) => toMeal(row, school))
      .filter((meal) => meal.kind === "lunch");
    if (meals.length > 0) {
      await db.meals.bulkPut(meals);
    }
    return meals;
  } catch (error) {
    const cached = await db.meals
      .where("[schoolCode+date]")
      .between([school.schoolCode, start], [school.schoolCode, end], true, true)
      .toArray();
    if (cached.length > 0) {
      return cached.sort((a, b) => a.date.localeCompare(b.date));
    }
    throw error;
  }
}

export async function getTodayTomorrowWeek(school: School, apiKey?: string) {
  const today = new Date();
  const meals = await getMealsByRange(school, today, addDays(today, 6), apiKey);
  return {
    today: meals.find((meal) => meal.date === yyyymmdd(today)),
    tomorrow: meals.find((meal) => meal.date === yyyymmdd(addDays(today, 1))),
    week: meals,
  };
}
