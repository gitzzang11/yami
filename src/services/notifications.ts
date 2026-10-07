"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { addDays } from "date-fns";
import { db } from "@/db/app-db";
import { yyyymmdd } from "@/lib/utils";
import type { AiReview, Meal, MealKind } from "@/types";

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      return result === "granted";
    }
    return false;
  }
  const permission = await LocalNotifications.requestPermissions();
  return permission.display === "granted";
}

export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const yyyymmddStr = `${year}${mmdd}`;

  // 1. 매년 고정된 공휴일 (양력)
  const solarHolidays = [
    "0101", // 신정
    "0301", // 삼일절
    "0505", // 어린이날
    "0606", // 현충일
    "0815", // 광복절
    "1003", // 개천절
    "1009", // 한글날
    "1225", // 성탄절
  ];

  if (solarHolidays.includes(mmdd)) {
    return true;
  }

  // 2026년부터 공휴일로 지정된 노동절과 제헌절.
  // https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431
  if (year >= 2026 && (mmdd === "0501" || mmdd === "0717")) return true;

  // 2. 대체공휴일 및 음력 공휴일 (2026년, 2027년 수동 매핑)
  const variableHolidays = [
    // 2026년
    "20260216", "20260217", "20260218", // 설날 연휴
    "20260302", // 삼일절 대체공휴일
    "20260524", "20260525", // 부처님오신날 및 대체공휴일
    "20260603", // 전국동시지방선거일
    "20260817", // 광복절 대체공휴일 (광복절: 8월 15일 토요일)
    "20260924", "20260925", "20260926", // 추석 연휴
    "20261005", // 개천절 대체공휴일 (개천절: 10월 3일 토요일)
    
    // 2027년
    "20270206", "20270207", "20270208", "20270209", // 설날 연휴 및 대체공휴일
    "20270503", // 노동절 대체공휴일
    "20270513", // 부처님오신날 (5월 13일 목요일)
    "20270719", // 제헌절 대체공휴일
    "20270816", // 광복절 대체공휴일 (광복절: 8월 15일 일요일)
    "20270914", "20270915", "20270916", // 추석 연휴
    "20271004", // 개천절 대체공휴일 (개천절: 10월 3일 일요일)
    "20271011", // 한글날 대체공휴일 (한글날: 10월 9일 토요일)
    "20271227", // 성탄절 대체공휴일 (성탄절: 12월 25일 토요일)
  ];

  if (variableHolidays.includes(yyyymmddStr)) {
    return true;
  }

  return false;
}

export function formatNotificationContent(
  meal?: Meal,
  review?: AiReview,
): { title: string; body: string } {
  if (!meal || !meal.menu || meal.menu.length === 0) {
    return {
      title: "오늘의 급식",
      body: "급식을 확인하고 AI 평가를 받아보세요.",
    };
  }

  const mealKind = meal.kindName || "급식";
  const title = `오늘의 ${mealKind}${review ? ` (${review.totalScore}점)` : ""}`;
  
  // 전체 급식 메뉴 목록을 누락 없이 전부 포함
  const fullMenuText = meal.menu.join(", ");
  const reviewText = review?.oneLine ? ` · "${review.oneLine}"` : "";
  const calText = meal.calories ? ` [${meal.calories}]` : "";

  const body = `${fullMenuText}${calText}${reviewText}`;

  return { title, body };
}

type MealNotificationContext = { schoolCode?: string; mealKind: MealKind };
const KEYWORD_D_MINUS_1_ID = 100000000;
const KEYWORD_D_DAY_ID = 200000000;
let notificationUpdate = Promise.resolve();

// 네이티브 예약 중 다음 갱신이 취소를 먼저 수행하면 오래된 예약이 다시 남는다.
function enqueueNotificationUpdate(update: () => Promise<void>): Promise<void> {
  const task = notificationUpdate.then(update);
  notificationUpdate = task.catch(() => {});
  return task;
}

function isKeywordNotification(notification: { id: number; title?: string }): boolean {
  return (notification.id >= KEYWORD_D_MINUS_1_ID && notification.id < 300000000)
    || (notification.id >= 10000000 && notification.id < 30000000
      && (notification.title?.includes("[D-1]") === true || notification.title?.includes("[D-DAY]") === true));
}

async function cancelDailyMealNotifications() {
  const pending = await LocalNotifications.getPending();
  const daily = pending.notifications.filter((notification) => notification.id === 1001
    || (notification.id >= 20000000 && notification.id < 30000000 && !isKeywordNotification(notification)));
  if (daily.length > 0) {
    await LocalNotifications.cancel({ notifications: daily.map((notification) => ({ id: notification.id })) });
  }
}

function isSchoolDay(date: Date): boolean {
  return date.getDay() !== 0 && date.getDay() !== 6 && !isHoliday(date);
}

function matchesMealDate(meal: Meal | undefined, date: string, context: MealNotificationContext): meal is Meal {
  return !!meal && meal.date === date && meal.schoolCode === context.schoolCode && meal.kind === context.mealKind;
}

async function getNotificationMeal(date: string, context: MealNotificationContext, supplied?: Meal): Promise<Meal | undefined> {
  if (!context.schoolCode) return undefined;
  if (matchesMealDate(supplied, date, context)) return supplied;
  try {
    return await db.meals.where("[schoolCode+date+kind]").equals([context.schoolCode, date, context.mealKind]).first();
  } catch (e) {
    console.error(`${date} 알림 급식 로드 실패`, e);
    return undefined;
  }
}

function hasMealMenu(meal: Meal | undefined): meal is Meal {
  return !!meal?.menu?.some((item) => item.trim().length > 0);
}

async function getNotificationReview(meal: Meal, supplied?: AiReview): Promise<AiReview | undefined> {
  if (supplied?.mealId === meal.id) return supplied;
  try {
    return await db.reviews.where("mealId").equals(meal.id).last();
  } catch (e) {
    console.error(`${meal.date} 알림 평가 로드 실패`, e);
    return undefined;
  }
}

export function scheduleDailyMealNotification(
  time: string,
  meal?: Meal,
  review?: AiReview,
  context: MealNotificationContext = { schoolCode: meal?.schoolCode, mealKind: meal?.kind ?? "lunch" },
) {
  return enqueueNotificationUpdate(() => updateDailyMealNotification(time, meal, review, context));
}

async function updateDailyMealNotification(
  time: string,
  meal: Meal | undefined,
  review: AiReview | undefined,
  context: MealNotificationContext,
) {
  const [hour, minute] = time.split(":").map(Number);
  const now = new Date();

  if (!Capacitor.isNativePlatform()) {
    if (!context.schoolCode || !isSchoolDay(now)) return;
    const currentMeal = await getNotificationMeal(yyyymmdd(now), context, meal);
    if (!hasMealMenu(currentMeal)) return;
    const currentReview = await getNotificationReview(currentMeal, review);
    const { title, body } = formatNotificationContent(currentMeal, currentReview);
    if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  // 급식 없는 날에 남아 있는 이전 예약도 먼저 해제한다.
  try {
    await cancelDailyMealNotifications();
  } catch (e) {
    console.error("기존 알림 스케줄 해제 실패", e);
  }

  if (!context.schoolCode) return;

  const notificationsToSchedule = [];

  // 향후 7일 간의 알림을 개별 예약
  for (let i = 0; i < 7; i++) {
    const targetDate = addDays(now, i);
    const dateStr = yyyymmdd(targetDate);
    
    // 주말(토요일/일요일)이거나 법정 공휴일인 경우는 알림을 예약하지 않고 스킵
    if (!isSchoolDay(targetDate)) {
      continue;
    }

    const scheduleTime = new Date(targetDate);
    scheduleTime.setHours(hour, minute, 0, 0);

    // 이미 당일 설정 시간이 지난 경우는 다음 날부터 예약하기 위해 건너뜀
    if (scheduleTime.getTime() <= Date.now()) {
      continue;
    }

    const currentMeal = await getNotificationMeal(dateStr, context, meal);
    if (!hasMealMenu(currentMeal)) continue;
    const currentReview = await getNotificationReview(currentMeal, review);

    const { title, body } = formatNotificationContent(currentMeal, currentReview);

    notificationsToSchedule.push({
      id: Number(dateStr),
      title,
      body,
      schedule: { at: scheduleTime, allowWhileIdle: true },
      smallIcon: "ic_stat_yami",
    });
  }

  if (notificationsToSchedule.length > 0) {
    try {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    } catch (e) {
      console.error("로컬 알림 신규 등록 실패", e);
    }
  }
}

export function disableMealNotification() {
  return enqueueNotificationUpdate(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await cancelDailyMealNotifications();
      } catch (e) {
        console.error("일일 급식 알림 해제 실패", e);
      }
    }
  });
}

export async function sendTestNotification(meal?: Meal, review?: AiReview) {
  let finalMeal = meal;
  let finalReview = review;

  if (!finalMeal) {
    try {
      const todayStr = yyyymmdd(new Date());
      const cachedMeal = await db.meals.where("date").equals(todayStr).first();
      if (cachedMeal) {
        finalMeal = cachedMeal;
        const cachedReview = await db.reviews.where("mealId").equals(cachedMeal.id).last();
        if (cachedReview) {
          finalReview = cachedReview;
        }
      } else {
        const allMeals = await db.meals.toArray();
        if (allMeals.length > 0) {
          const todayNum = Number(todayStr);
          allMeals.sort((a, b) => {
            const diffA = Math.abs(Number(a.date) - todayNum);
            const diffB = Math.abs(Number(b.date) - todayNum);
            return diffA - diffB;
          });
          const nearestMeal = allMeals[0];
          finalMeal = nearestMeal;
          const cachedReview = await db.reviews.where("mealId").equals(nearestMeal.id).last();
          if (cachedReview) {
            finalReview = cachedReview;
          }
        }
      }
    } catch (e) {
      console.error("테스트 알림 폴백 조회 실패", e);
    }
  }

  const { title, body } = formatNotificationContent(finalMeal, finalReview);

  if (!Capacitor.isNativePlatform()) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  await LocalNotifications.schedule({
    notifications: [{ id: 1002, title, body, schedule: { at: new Date(Date.now() + 1000) } }],
  });
}

export function getFavoriteDMinus1Message(
  firstKeyword: string,
  matchedMenus: string[],
  mealKind: string = "급식",
  fullMenu: string[] = [],
): { title: string; body: string } {
  const title = `📢 [D-1] 내일 최애 메뉴 나온다! (${firstKeyword}) 💓`;
  const wittyLines = [
    `내일 ${mealKind}에 최애 '${matchedMenus.join(", ")}' 출격 대기 중! 🤤 벌써 침 고이는 중... 숟가락 갈고 일찍 자요! 😴✨`,
    `내일은 절대 급식 패스 금지! 최애 '${matchedMenus.join(", ")}' 나오는 날! 🏃💨 4교시 종 치자마자 1등 달리기 시동 거세요!`,
    `두근두근 심장 박동수 급상승! 내일 '${matchedMenus.join(", ")}' 등장 실화?! 🍱🔥 내일 밥 두 공기 비빌 각입니다!`,
  ];
  const index = Math.abs(firstKeyword.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % wittyLines.length;
  const body = fullMenu.length > 0 
    ? `${wittyLines[index]}\n내일 식단: ${fullMenu.join(", ")}`
    : wittyLines[index];
  return { title, body };
}

export function getFavoriteDDayMessage(
  firstKeyword: string,
  matchedMenus: string[],
  mealKind: string = "급식",
  fullMenu: string[] = [],
): { title: string; body: string } {
  const title = `🎉 [D-DAY] 오늘 ${mealKind}에 최애 메뉴 등장! (${firstKeyword}) ❤️`;
  const wittyLines = [
    `드디어 오늘! ${mealKind}에 기다리고 기다리던 '${matchedMenus.join(", ")}' 먹는 날! 🍱✨ 영양사 선생님 방향으로 넙죽 절 올리고 식판 두 번 채우기 약속! 🍚😋`,
    `오늘 ${mealKind} 텐션 무한 상승! '${matchedMenus.join(", ")}' 나왔어요! 🤤 친구들이랑 반찬 물물교환 협상 테이블 준비 완료! 🥢🔥`,
    `행복 지수 100% 충전 완료! 최애 '${matchedMenus.join(", ")}' ${mealKind} 출격 완료! 🏃💨 오늘 점심은 무조건 완식하고 행복해지기! ❤️`,
  ];
  const index = Math.abs(firstKeyword.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % wittyLines.length;
  const body = fullMenu.length > 0
    ? `${wittyLines[index]}\n전체 식단: ${fullMenu.join(", ")}`
    : wittyLines[index];
  return { title, body };
}

export function scheduleKeywordMealNotifications(
  time: string,
  keywords: string[],
  schoolCode?: string,
) {
  return enqueueNotificationUpdate(() => updateKeywordMealNotifications(time, keywords, schoolCode));
}

async function updateKeywordMealNotifications(
  time: string,
  keywords: string[],
  schoolCode?: string,
) {
  const [hour, minute] = time.split(":").map(Number);

  if (!Capacitor.isNativePlatform()) return;

  try {
    // 이전 버전의 예약도 제거하되 일일 급식 알림은 유지한다.
    const pending = await LocalNotifications.getPending();
    const keywordPending = pending.notifications.filter(isKeywordNotification);
    if (keywordPending.length > 0) {
      await LocalNotifications.cancel({
        notifications: keywordPending.map((n) => ({ id: n.id })),
      });
    }

    if (!keywords || keywords.length === 0 || !schoolCode) return;

    const today = new Date();
    const startStr = yyyymmdd(today);
    const endStr = yyyymmdd(addDays(today, 14));

    const upcomingMeals = await db.meals
      .where("schoolCode")
      .equals(schoolCode)
      .filter((m) => m.date >= startStr && m.date <= endStr)
      .toArray();

    const notificationsToSchedule = [];
    const mealDates = new Set(upcomingMeals.filter(hasMealMenu).map((meal) => meal.date));

    for (const meal of upcomingMeals) {
      const year = Number(meal.date.slice(0, 4));
      const month = Number(meal.date.slice(4, 6)) - 1;
      const day = Number(meal.date.slice(6, 8));
      const targetDate = new Date(year, month, day, hour, minute, 0, 0);

      // 주말이나 공휴일 급식은 스킵
      if (!isSchoolDay(targetDate) || !hasMealMenu(meal)) continue;

      const matchedMenus = meal.menu.filter((m) =>
        keywords.some((k) => m.toLowerCase().includes(k.toLowerCase())),
      );

      if (matchedMenus.length > 0) {
        const firstKeyword = keywords.find((k) =>
          matchedMenus[0].toLowerCase().includes(k.toLowerCase()),
        ) || keywords[0];

        const numericDate = Number(meal.date) % 1000000;

        // 1. 📢 전날 (D-1) 저녁 알림 (저녁 19:30 예약)
        const dMinus1Date = new Date(year, month, day - 1, 19, 30, 0, 0);
        if (dMinus1Date.getTime() > Date.now() && isSchoolDay(dMinus1Date)
          && mealDates.has(yyyymmdd(dMinus1Date))) {
          const { title: d1Title, body: d1Body } = getFavoriteDMinus1Message(
            firstKeyword,
            matchedMenus,
            meal.kindName || "급식",
            meal.menu,
          );
          notificationsToSchedule.push({
            id: KEYWORD_D_MINUS_1_ID + numericDate,
            title: d1Title,
            body: d1Body,
            schedule: { at: dMinus1Date, allowWhileIdle: true },
            smallIcon: "ic_stat_yami",
          });
        }

        // 2. 🎉 당일 (D-DAY) 설정 시간 알림
        if (targetDate.getTime() > Date.now()) {
          const { title: dDayTitle, body: dDayBody } = getFavoriteDDayMessage(
            firstKeyword,
            matchedMenus,
            meal.kindName || "급식",
            meal.menu,
          );
          notificationsToSchedule.push({
            id: KEYWORD_D_DAY_ID + numericDate,
            title: dDayTitle,
            body: dDayBody,
            schedule: { at: targetDate, allowWhileIdle: true },
            smallIcon: "ic_stat_yami",
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      });
    }
  } catch (e) {
    console.error("최애 메뉴 키워드 알림 등록 실패", e);
  }
}

export async function sendTestKeywordNotification(
  keyword = "치킨",
  menuName = "뿌링클 순살 치킨",
  mode: "d-day" | "d-1" = "d-day",
) {
  const { title, body } =
    mode === "d-1"
      ? getFavoriteDMinus1Message(keyword, [menuName], "중식", [
          menuName,
          "찰현미밥",
          "꽃게탕",
          "계란찜",
          "깍두기",
        ])
      : getFavoriteDDayMessage(keyword, [menuName], "중식", [
          menuName,
          "찰현미밥",
          "꽃게탕",
          "계란찜",
          "깍두기",
        ]);

  if (!Capacitor.isNativePlatform()) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  const notifId = mode === "d-1" ? 1004 : 1003;
  await LocalNotifications.schedule({
    notifications: [{ id: notifId, title, body, schedule: { at: new Date(Date.now() + 1000) } }],
  });
}
