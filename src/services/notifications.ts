"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
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
  const title = meal ? `오늘의 급식 ${review ? `${review.totalScore}점` : ""}` : "오늘의 급식";
  const body = meal
    ? `${meal.menu.slice(0, 4).join(", ")}${review ? ` · ${review.oneLine}` : ""}`
    : "급식을 확인하고 AI 평가를 받아보세요.";

  if (!Capacitor.isNativePlatform()) {
    if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
    return;
  }

  await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title,
        body,
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        smallIcon: "ic_stat_icon_config_sample",
      },
    ],
  });
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
        const lastMeal = await db.meals.orderBy("date").reverse().first();
        if (lastMeal) {
          finalMeal = lastMeal;
          const cachedReview = await db.reviews.where("mealId").equals(lastMeal.id).last();
          if (cachedReview) {
            finalReview = cachedReview;
          }
        }
      }
    } catch (e) {
      console.error("테스트 알림 폴백 조회 실패", e);
    }
  }

  const title = finalReview ? `테스트 알림 · ${finalReview.totalScore}점` : "급식평론가 테스트";
  const body = finalMeal
    ? `${finalMeal.menu.slice(0, 4).join(", ")}${finalReview ? ` · ${finalReview.oneLine}` : ""}`
    : "알림이 정상적으로 도착했습니다.";

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
