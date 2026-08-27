"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/db/app-db";
import { getUserMealFeedback } from "@/services/feedback";
import { getAllReviewsForMeal } from "@/services/gemini";
import { getSchoolSchedulesByRange, getTodayTomorrowWeek } from "@/services/neis";
import type { AiReview, LoadState, Meal, MealKind, School, SchoolScheduleEvent, UserMealFeedback } from "@/types";

export function useMealData(school?: School, neisApiKey?: string, initialKind: MealKind = "lunch") {
  const [mealKind, setMealKind] = useState<MealKind>(initialKind);
  const [today, setToday] = useState<Meal>();
  const [tomorrow, setTomorrow] = useState<Meal>();
  const [week, setWeek] = useState<Meal[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [review, setReview] = useState<AiReview>();
  const [todaySchedules, setTodaySchedules] = useState<SchoolScheduleEvent[]>([]);
  const [todayFeedback, setTodayFeedback] = useState<UserMealFeedback>();
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!school) {
      setState("empty");
      setTodaySchedules([]);
      setTodayFeedback(undefined);
      setReviews([]);
      setReview(undefined);
      return;
    }
    setState("loading");
    setError("");
    try {
      const todayDate = new Date();
      const [data, fetchedSchedules] = await Promise.all([
        getTodayTomorrowWeek(school, neisApiKey, mealKind),
        getSchoolSchedulesByRange(school, todayDate, todayDate, neisApiKey),
      ]);
      setToday(data.today);
      setTomorrow(data.tomorrow);
      setWeek(data.week);
      setTodaySchedules(fetchedSchedules);
      setOffline(false);
      setState(data.today || data.week.length ? "success" : "empty");
      if (data.today) {
        const [allReviews, feedback] = await Promise.all([
          getAllReviewsForMeal(
            data.today.id,
            school.schoolCode,
            data.today.date,
            mealKind,
          ),
          getUserMealFeedback(school.schoolCode, data.today.date, mealKind),
        ]);
        setReviews(allReviews);
        setReview(allReviews[0]);
        setTodayFeedback(feedback);
      } else {
        setReviews([]);
        setReview(undefined);
        setTodayFeedback(undefined);
      }
    } catch (err) {
      const cached = await db.meals
        .where("schoolCode")
        .equals(school.schoolCode)
        .filter((m) => m.kind === mealKind)
        .reverse()
        .sortBy("date");
      setWeek(cached.slice(0, 7).reverse());
      setToday(cached[0]);
      if (cached[0]) {
        const [allReviews, feedback] = await Promise.all([
          getAllReviewsForMeal(
            cached[0].id,
            school.schoolCode,
            cached[0].date,
            mealKind,
          ),
          getUserMealFeedback(school.schoolCode, cached[0].date, mealKind),
        ]);
        setReviews(allReviews);
        setReview(allReviews[0]);
        setTodayFeedback(feedback);
        setOffline(true);
        setState("success");
      } else {
        setError(err instanceof Error ? err.message : "급식 정보를 불러오지 못했습니다.");
        setState("error");
      }
    }
  }, [school, neisApiKey, mealKind]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  return {
    mealKind,
    setMealKind,
    today,
    tomorrow,
    week,
    reviews,
    setReviews,
    review,
    setReview,
    todaySchedules,
    todayFeedback,
    setTodayFeedback,
    state,
    error,
    offline,
    reload: load,
  };
}
