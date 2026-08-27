"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { addDays } from "date-fns";
import { db } from "@/db/app-db";
import { yyyymmdd } from "@/lib/utils";
import type { AiReview, Meal } from "@/types";

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

  // 2. 대체공휴일 및 음력 공휴일 (2026년, 2027년 수동 매핑)
  const variableHolidays = [
    // 2026년
    "20260216", "20260217", "20260218", // 설날 연휴
    "20260302", // 삼일절 대체공휴일
    "20260525", // 부처님오신날 대체공휴일 (부처님오신날: 5월 24일 일요일)
    "20260817", // 광복절 대체공휴일 (광복절: 8월 15일 토요일)
    "20260924", "20260925", "20260926", "20260928", // 추석 연휴 및 대체공휴일
    "20261005", // 개천절 대체공휴일 (개천절: 10월 3일 토요일)
    
    // 2027년
    "20270205", "20270206", "20270207", "20270208", // 설날 연휴 및 대체공휴일
    "20270513", // 부처님오신날 (5월 13일 목요일)
    "20270607", // 현충일 대체공휴일 (현충일: 6월 6일 일요일)
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

export async function scheduleDailyMealNotification(
  time: string,
  meal?: Meal,
  review?: AiReview,
) {
  const [hour, minute] = time.split(":").map(Number);

  // 1. 웹 브라우저 등 비네이티브 환경: 즉각적 1회성 알림만 전송하고 스케줄링 생략
  if (!Capacitor.isNativePlatform()) {
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
        console.error("웹 알림 폴백 조회 실패", e);
      }
    }
    const { title, body } = formatNotificationContent(finalMeal, finalReview);

    if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  // 2. 모바일 네이티브 환경 (Capacitor)
  // 대기 중인 모든 이전 예약 건을 확실하게 제거하여 누적이나 오작동 방지
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch (e) {
    console.error("기존 알림 스케줄 해제 실패", e);
  }

  const notificationsToSchedule = [];

  // 향후 7일 간의 알림을 개별 예약
  for (let i = 0; i < 7; i++) {
    const targetDate = addDays(new Date(), i);
    const dateStr = yyyymmdd(targetDate);
    
    // 주말(토요일/일요일)이거나 법정 공휴일인 경우는 알림을 예약하지 않고 스킵
    const day = targetDate.getDay();
    if (day === 0 || day === 6 || isHoliday(targetDate)) {
      continue;
    }

    const scheduleTime = new Date(targetDate);
    scheduleTime.setHours(hour, minute, 0, 0);

    // 이미 당일 설정 시간이 지난 경우는 다음 날부터 예약하기 위해 건너뜀
    if (scheduleTime.getTime() <= Date.now()) {
      continue;
    }

    let currentMeal: Meal | undefined = undefined;
    let currentReview: AiReview | undefined = undefined;

    if (i === 0 && meal) {
      currentMeal = meal;
      currentReview = review;
    } else {
      try {
        currentMeal = await db.meals.where("date").equals(dateStr).first();
        if (currentMeal) {
          currentReview = await db.reviews.where("mealId").equals(currentMeal.id).last();
        }
      } catch (e) {
        console.error(`${dateStr} 급식 로드 실패`, e);
      }
    }

    // 만약 해당 날짜의 급식 정보가 부재할 경우, DB에서 가장 가까운 날짜의 급식을 폴백으로 매핑
    if (!currentMeal) {
      try {
        const allMeals = await db.meals.toArray();
        if (allMeals.length > 0) {
          const targetNum = Number(dateStr);
          allMeals.sort((a, b) => {
            const diffA = Math.abs(Number(a.date) - targetNum);
            const diffB = Math.abs(Number(b.date) - targetNum);
            return diffA - diffB;
          });
          const nearestMeal = allMeals[0];
          currentMeal = nearestMeal;
          currentReview = await db.reviews.where("mealId").equals(nearestMeal.id).last();
        }
      } catch (e) {
        console.error("폴백 급식 로드 실패", e);
      }
    }

    const { title, body } = formatNotificationContent(currentMeal, currentReview);

    notificationsToSchedule.push({
      id: Number(dateStr),
      title,
      body,
      schedule: { at: scheduleTime, allowWhileIdle: true },
      smallIcon: "ic_stat_icon_config_sample",
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

export async function disableMealNotification() {
  if (Capacitor.isNativePlatform()) {
    try {
      // 예약된 알림 전체를 취소 (날짜 기반 ID 포함)
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
    } catch (e) {
      console.error("알림 전체 해제 실패", e);
    }
  }
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

export async function scheduleKeywordMealNotifications(
  time: string,
  keywords: string[],
  schoolCode?: string,
) {
  if (!keywords || keywords.length === 0 || !schoolCode) return;
  const [hour, minute] = time.split(":").map(Number);

  if (!Capacitor.isNativePlatform()) return;

  try {
    const today = new Date();
    const startStr = yyyymmdd(today);
    const endStr = yyyymmdd(addDays(today, 14));

    const upcomingMeals = await db.meals
      .where("schoolCode")
      .equals(schoolCode)
      .filter((m) => m.date >= startStr && m.date <= endStr)
      .toArray();

    const notificationsToSchedule = [];

    for (const meal of upcomingMeals) {
      const year = Number(meal.date.slice(0, 4));
      const month = Number(meal.date.slice(4, 6)) - 1;
      const day = Number(meal.date.slice(6, 8));
      const targetDate = new Date(year, month, day, hour, minute, 0, 0);

      // 이미 지난 시간이나 주말/휴일은 제외
      if (targetDate.getTime() <= Date.now()) continue;
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(targetDate)) continue;

      const matchedMenus = meal.menu.filter((m) =>
        keywords.some((k) => m.toLowerCase().includes(k.toLowerCase())),
      );

      if (matchedMenus.length > 0) {
        const firstKeyword = keywords.find((k) =>
          matchedMenus[0].toLowerCase().includes(k.toLowerCase()),
        ) || keywords[0];

        const title = `⭐ 최애 메뉴 등장! (${firstKeyword})`;
        const body = `오늘 ${meal.kindName || "급식"}에 '${matchedMenus.join(", ")}'이(가) 나옵니다! 🍱\n전체 메뉴: ${meal.menu.join(", ")}`;

        // 20000000 + dateStr
        const notifId = 20000000 + (Number(meal.date) % 1000000);

        notificationsToSchedule.push({
          id: notifId,
          title,
          body,
          schedule: { at: targetDate, allowWhileIdle: true },
          smallIcon: "ic_stat_icon_config_sample",
        });
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

export async function sendTestKeywordNotification(keyword = "치킨", menuName = "뿌링클 순살 치킨") {
  const title = `⭐ 최애 메뉴 등장! (${keyword})`;
  const body = `오늘 급식에 '${menuName}'(이)가 나옵니다! 🍱\n전체 메뉴: ${menuName}, 찰현미밥, 꽃게탕, 계란찜, 깍두기`;

  if (!Capacitor.isNativePlatform()) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  await LocalNotifications.schedule({
    notifications: [{ id: 1003, title, body, schedule: { at: new Date(Date.now() + 1000) } }],
  });
}
