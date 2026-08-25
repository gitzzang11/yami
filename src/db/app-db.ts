"use client";

import Dexie, { type Table } from "dexie";
import type { AiReview, Criterion, Meal, School, SchoolScheduleEvent, UserMealFeedback } from "@/types";

class MealCriticDB extends Dexie {
  schools!: Table<School, string>;
  meals!: Table<Meal, string>;
  reviews!: Table<AiReview, string>;
  criteria!: Table<Criterion, string>;
  schedules!: Table<SchoolScheduleEvent, string>;
  userFeedbacks!: Table<UserMealFeedback, string>;

  constructor() {
    super("meal-critic-db");
    this.version(1).stores({
      schools: "id, name, officeCode, schoolCode",
      meals: "id, date, schoolCode, [schoolCode+date]",
      reviews: "id, mealId, date, totalScore, createdAt",
      criteria: "id, enabled",
    });
    this.version(2).stores({
      schools: "id, name, officeCode, schoolCode",
      meals: "id, date, schoolCode, kind, [schoolCode+date], [schoolCode+date+kind]",
      reviews: "id, mealId, schoolCode, date, mealKind, totalScore, createdAt, [schoolCode+date], [schoolCode+createdAt]",
      criteria: "id, enabled",
    });
    this.version(3).stores({
      schools: "id, name, officeCode, schoolCode",
      meals: "id, date, schoolCode, kind, [schoolCode+date], [schoolCode+date+kind]",
      reviews: "id, mealId, schoolCode, date, mealKind, totalScore, createdAt, [schoolCode+date], [schoolCode+createdAt]",
      criteria: "id, enabled",
      schedules: "id, schoolCode, date, eventType, [schoolCode+date]",
    });
    this.version(4).stores({
      schools: "id, name, officeCode, schoolCode",
      meals: "id, date, schoolCode, kind, [schoolCode+date], [schoolCode+date+kind]",
      reviews: "id, mealId, schoolCode, date, mealKind, totalScore, createdAt, [schoolCode+date], [schoolCode+createdAt]",
      criteria: "id, enabled",
      schedules: "id, schoolCode, date, eventType, [schoolCode+date]",
      userFeedbacks: "id, mealId, schoolCode, date, mealKind, score, reaction, createdAt, [schoolCode+date]",
    });
  }
}

export const db = new MealCriticDB();

export async function clearCachedData() {
  await Promise.all([
    db.meals.clear(),
    db.reviews.clear(),
    db.schedules.clear(),
    db.userFeedbacks.clear(),
  ]);
}
