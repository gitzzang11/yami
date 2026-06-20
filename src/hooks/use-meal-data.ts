"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/db/app-db";
import { getLatestReview } from "@/services/gemini";
import { getTodayTomorrowWeek } from "@/services/neis";
import type { AiReview, LoadState, Meal, School } from "@/types";

export function useMealData(school?: School, neisApiKey?: string) {
  const [today, setToday] = useState<Meal>();
  const [tomorrow, setTomorrow] = useState<Meal>();
  const [week, setWeek] = useState<Meal[]>([]);
  const [review, setReview] = useState<AiReview>();
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!school) {
      setState("empty");
      return;
    }
    setState("loading");
    setError("");
    try {
      const data = await getTodayTomorrowWeek(school, neisApiKey);
      setToday(data.today);
      setTomorrow(data.tomorrow);
      setWeek(data.week);
      setOffline(false);
      setState(data.today || data.week.length ? "success" : "empty");
      if (data.today) {
        setReview(await getLatestReview(data.today.id));
      }
    } catch (err) {
      const cached = await db.meals.where("schoolCode").equals(school.schoolCode).reverse().sortBy("date");
      setWeek(cached.slice(0, 7).reverse());
      setToday(cached[0]);
      if (cached[0]) {
        setReview(await getLatestReview(cached[0].id));
        setOffline(true);
        setState("success");
      } else {
        setError(err instanceof Error ? err.message : "급식 정보를 불러오지 못했습니다.");
        setState("error");
      }
    }
  }, [school, neisApiKey]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  return { today, tomorrow, week, review, setReview, state, error, offline, reload: load };
}
