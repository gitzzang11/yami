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
    const title = finalMeal ? `오늘의 급식 ${finalReview ? `${finalReview.totalScore}점` : ""}` : "오늘의 급식";
    const body = finalMeal
      ? `${finalMeal.menu.slice(0, 4).join(", ")}${finalReview ? ` · ${finalReview.oneLine}` : ""}`
      : "급식을 확인하고 AI 평가를 받아보세요.";

    if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  // 2. 모바일 네이티브 환경 (Capacitor)
  // 대기 중인 모든 이전 예약 건을 확실하게 제거하여 누적이나 오작동 방지
  try {
    const pending = await LocalNotifications.getPending();
    const cancelList = [{ id: 1001 }, { id: 1002 }];
    pending.notifications.forEach((n) => {
      if (n.id !== 1001 && n.id !== 1002) {
        cancelList.push({ id: n.id });
      }
    });
    await LocalNotifications.cancel({ notifications: cancelList });
  } catch (e) {
    console.error("기존 알림 스케줄 해제 실패", e);
  }

  const notificationsToSchedule = [];

  // 향후 7일 간의 알림을 개별 예약
  for (let i = 0; i < 7; i++) {
    const targetDate = addDays(new Date(), i);
    const dateStr = yyyymmdd(targetDate);
    
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

    const title = currentMeal ? `오늘의 급식 ${currentReview ? `${currentReview.totalScore}점` : ""}` : "오늘의 급식";
    const body = currentMeal
      ? `${currentMeal.menu.slice(0, 4).join(", ")}${currentReview ? ` · ${currentReview.oneLine}` : ""}`
      : "급식을 확인하고 AI 평가를 받아보세요.";

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
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] });
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

  const title = finalMeal ? `오늘의 급식 ${finalReview ? `${finalReview.totalScore}점` : ""}` : "오늘의 급식";
  const body = finalMeal
    ? `${finalMeal.menu.slice(0, 4).join(", ")}${finalReview ? ` · ${finalReview.oneLine}` : ""}`
    : "급식을 확인하고 AI 평가를 받아보세요.";

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
