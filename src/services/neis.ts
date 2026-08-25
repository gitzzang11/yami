import { addDays } from "date-fns";
import { db } from "@/db/app-db";
import { parseMenuWithAllergies, yyyymmdd } from "@/lib/utils";
import type { Meal, MealKind, NeisMealRow, NeisSchoolScheduleRow, ScheduleEventType, School, SchoolScheduleEvent } from "@/types";

const BASE_URL = "https://open.neis.go.kr/hub";

type NeisSchoolRow = {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  ORG_RDNMA?: string;
  SCHUL_KND_SC_NM?: string;
};

function withOptionalKey(apiKey?: string) {
  const key = apiKey?.trim();
  return key ? { KEY: key } : {};
}

async function fetchNeis<T>(endpoint: string, params: Record<string, string | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  searchParams.set("Type", "json");
  searchParams.set("pIndex", "1");
  searchParams.set("pSize", "100");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, value);
    }
  }

  const url = `${BASE_URL}/${endpoint}?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NEIS API 요청 실패 (${response.status})`);
  }
  const payload = await response.json();
  const result = payload?.RESULT;
  if (result && result.CODE && result.CODE !== "INFO-000" && result.CODE !== "INFO-200") {
    throw new Error(result.MESSAGE ?? "NEIS API 에러");
  }
  return payload as T;
}

export async function searchSchools(keyword: string, apiKey?: string): Promise<School[]> {
  const query = keyword.trim();
  if (!query) return [];

  const data = await fetchNeis<{ schoolInfo?: [{ head: unknown }, { row: NeisSchoolRow[] }] }>(
    "schoolInfo",
    {
      ...withOptionalKey(apiKey),
      SCHUL_NM: query,
    },
  );

  const schools = (data.schoolInfo?.[1]?.row ?? []).map((row) => ({
    id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`,
    officeCode: row.ATPT_OFCDC_SC_CODE,
    schoolCode: row.SD_SCHUL_CODE,
    name: row.SCHUL_NM,
    address: row.ORG_RDNMA ?? "",
    kind: row.SCHUL_KND_SC_NM ?? "학교",
  }));
  if (schools.length > 0) {
    await db.schools.bulkPut(schools);
  }
  return schools;
}

const MEAL_KIND_MAP: Record<string, MealKind> = {
  조식: "breakfast",
  중식: "lunch",
  석식: "dinner",
};

function toMeal(row: NeisMealRow, school: School): Meal {
  const menuItems = parseMenuWithAllergies(row.DDISH_NM);
  const menu = menuItems.map((item) => item.name);
  const kind = MEAL_KIND_MAP[row.MMEAL_SC_NM] ?? "lunch";
  return {
    id: `${row.SD_SCHUL_CODE}-${row.MLSV_YMD}-${kind}`,
    officeCode: row.ATPT_OFCDC_SC_CODE,
    schoolCode: row.SD_SCHUL_CODE,
    schoolName: row.SCHUL_NM || school.name,
    date: row.MLSV_YMD,
    kind,
    kindName: row.MMEAL_SC_NM || "중식",
    menu,
    menuItems,
    rawMenu: row.DDISH_NM,
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
  kind?: MealKind,
): Promise<Meal[]> {
  const start = yyyymmdd(from);
  const end = yyyymmdd(to);
  try {
    const data = await fetchNeis<{ mealServiceDietInfo?: [{ head: unknown }, { row: NeisMealRow[] }] }>(
      "mealServiceDietInfo",
      {
        ...withOptionalKey(apiKey),
        ATPT_OFCDC_SC_CODE: school.officeCode,
        SD_SCHUL_CODE: school.schoolCode,
        MLSV_FROM_YMD: start,
        MLSV_TO_YMD: end,
      },
    );
    const meals = (data.mealServiceDietInfo?.[1]?.row ?? []).map((row) => toMeal(row, school));
    if (meals.length > 0) {
      await db.meals.bulkPut(meals);
    }
    const filtered = kind ? meals.filter((meal) => meal.kind === kind) : meals;
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    const cached = await db.meals
      .where("[schoolCode+date]")
      .between([school.schoolCode, start], [school.schoolCode, end], true, true)
      .toArray();
    if (cached.length > 0) {
      const filtered = kind ? cached.filter((meal) => meal.kind === kind) : cached;
      return filtered.sort((a, b) => a.date.localeCompare(b.date));
    }
    throw error;
  }
}

export async function getTodayTomorrowWeek(school: School, apiKey?: string, kind: MealKind = "lunch") {
  const today = new Date();
  const meals = await getMealsByRange(school, today, addDays(today, 6), apiKey, kind);
  return {
    today: meals.find((meal) => meal.date === yyyymmdd(today)),
    tomorrow: meals.find((meal) => meal.date === yyyymmdd(addDays(today, 1))),
    week: meals,
  };
}

export function classifyScheduleEventType(
  eventName: string,
  dayType?: string,
): ScheduleEventType {
  const name = eventName.toLowerCase();
  const day = (dayType || "").toLowerCase();

  if (
    name.includes("고사") ||
    name.includes("시험") ||
    name.includes("평가") ||
    name.includes("학력평가") ||
    name.includes("모의고사") ||
    name.includes("지필") ||
    name.includes("수행")
  ) {
    return "exam";
  }

  if (
    name.includes("방학") ||
    name.includes("개학") ||
    name.includes("휴가") ||
    day.includes("방학")
  ) {
    return "vacation";
  }

  if (
    name.includes("휴업") ||
    name.includes("재량") ||
    name.includes("개교기념일") ||
    name.includes("공휴") ||
    name.includes("연휴") ||
    day.includes("휴업") ||
    day.includes("공휴")
  ) {
    return "holiday";
  }

  if (
    name.includes("체험") ||
    name.includes("축제") ||
    name.includes("수학여행") ||
    name.includes("수련") ||
    name.includes("체육") ||
    name.includes("소풍") ||
    name.includes("대회") ||
    name.includes("한마당")
  ) {
    return "festival";
  }

  return "general";
}

export function extractGradeTarget(row: NeisSchoolScheduleRow): string {
  const grades: string[] = [];
  if (row.ONE_GRADE_EVENT_YN === "Y") grades.push("1");
  if (row.TW_GRADE_EVENT_YN === "Y") grades.push("2");
  if (row.THREE_GRADE_EVENT_YN === "Y") grades.push("3");
  if (row.FOUR_GRADE_EVENT_YN === "Y") grades.push("4");
  if (row.FIVE_GRADE_EVENT_YN === "Y") grades.push("5");
  if (row.SIX_GRADE_EVENT_YN === "Y") grades.push("6");

  if (grades.length === 0 || grades.length >= 3) {
    return "전학년";
  }
  return `${grades.join(", ")}학년`;
}

export async function getSchoolSchedulesByRange(
  school: School,
  from: Date,
  to: Date,
  apiKey?: string,
): Promise<SchoolScheduleEvent[]> {
  const start = yyyymmdd(from);
  const end = yyyymmdd(to);

  try {
    const data = await fetchNeis<{
      SchoolSchedule?: [{ head: unknown }, { row: NeisSchoolScheduleRow[] }];
    }>("SchoolSchedule", {
      ...withOptionalKey(apiKey),
      ATPT_OFCDC_SC_CODE: school.officeCode,
      SD_SCHUL_CODE: school.schoolCode,
      AA_FROM_YMD: start,
      AA_TO_YMD: end,
    });

    const rows = data.SchoolSchedule?.[1]?.row ?? [];
    const schedules: SchoolScheduleEvent[] = rows
      .filter((row) => row.EVENT_NM && row.EVENT_NM.trim().length > 0)
      .map((row) => {
        const eventType = classifyScheduleEventType(row.EVENT_NM, row.SBTR_DD_SC_NM);
        return {
          id: `${school.schoolCode}-${row.AA_YMD}-${row.EVENT_NM.trim()}`,
          schoolCode: school.schoolCode,
          date: row.AA_YMD,
          eventName: row.EVENT_NM.trim(),
          eventContent: row.EVENT_CNTNT?.trim() || undefined,
          gradeTarget: extractGradeTarget(row),
          dayType: row.SBTR_DD_SC_NM?.trim() || undefined,
          eventType,
        };
      });

    if (schedules.length > 0) {
      await db.schedules.bulkPut(schedules);
    }
    return schedules.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    const cached = await db.schedules
      .where("[schoolCode+date]")
      .between([school.schoolCode, start], [school.schoolCode, end], true, true)
      .toArray();
    if (cached.length > 0) {
      return cached.sort((a, b) => a.date.localeCompare(b.date));
    }
    console.warn("학사일정 로드 실패:", error);
    return [];
  }
}
