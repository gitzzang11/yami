import { db } from "@/db/app-db";
import type {
  AiReview,
  DietCategoryStat,
  Meal,
  MealAward,
  MealKind,
  UserMealFeedback,
  UserMealReaction,
} from "@/types";

export const USER_REACTION_CONFIG: Record<
  UserMealReaction,
  { label: string; emoji: string; defaultScore: number; bgClass: string; activeClass: string }
> = {
  delicious: {
    label: "존맛",
    emoji: "😍",
    defaultScore: 100,
    bgClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    activeClass: "ring-2 ring-inset ring-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  },
  good: {
    label: "맛있음",
    emoji: "👍",
    defaultScore: 80,
    bgClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    activeClass: "ring-2 ring-inset ring-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  },
  soso: {
    label: "무난",
    emoji: "😐",
    defaultScore: 60,
    bgClass: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
    activeClass: "ring-2 ring-inset ring-zinc-500 bg-zinc-200 text-zinc-950 dark:bg-white/20 dark:text-white",
  },
  bad: {
    label: "별로",
    emoji: "🤢",
    defaultScore: 40,
    bgClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    activeClass: "ring-2 ring-inset ring-rose-500 bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
  },
  spicy: {
    label: "매움",
    emoji: "🔥",
    defaultScore: 50,
    bgClass: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    activeClass: "ring-2 ring-inset ring-orange-500 bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
  },
  little: {
    label: "양적음",
    emoji: "🤏",
    defaultScore: 50,
    bgClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    activeClass: "ring-2 ring-inset ring-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  },
};

export async function saveUserMealFeedback(
  meal: Meal,
  reaction: UserMealReaction,
  score: number,
  comment?: string,
): Promise<UserMealFeedback> {
  const feedback: UserMealFeedback = {
    id: `${meal.schoolCode}-${meal.date}-${meal.kind}`,
    mealId: meal.id,
    schoolCode: meal.schoolCode,
    date: meal.date,
    mealKind: meal.kind,
    score: Math.max(0, Math.min(100, score)),
    reaction,
    comment: comment?.trim() || undefined,
    createdAt: Date.now(),
  };
  await db.userFeedbacks.put(feedback);
  return feedback;
}

export async function getUserMealFeedback(
  schoolCode: string,
  date: string,
  kind?: MealKind,
): Promise<UserMealFeedback | undefined> {
  const list = await db.userFeedbacks
    .where("[schoolCode+date]")
    .equals([schoolCode, date])
    .toArray();
  if (list.length === 0) return undefined;
  if (kind) {
    return list.find((item) => item.mealKind === kind) ?? list[0];
  }
  return list[0];
}

export async function getUserFeedbacksBySchool(
  schoolCode: string,
): Promise<UserMealFeedback[]> {
  return db.userFeedbacks.where("schoolCode").equals(schoolCode).toArray();
}

/**
 * Calculates Awards (Legend, Worst, Calorie, Favorite) from meals, reviews, and feedbacks.
 */
export function calculateMealAwards(
  meals: Meal[],
  reviews: AiReview[],
  feedbacks: UserMealFeedback[],
  favoriteKeywords: string[] = [],
): MealAward[] {
  if (meals.length === 0) return [];

  const reviewMap = new Map<string, AiReview>();
  reviews.forEach((r) => reviewMap.set(r.date, r));

  const feedbackMap = new Map<string, UserMealFeedback>();
  feedbacks.forEach((f) => feedbackMap.set(f.date, f));

  const awards: MealAward[] = [];

  // 1. 🥇 Legend Meal (Highest combined or AI score)
  let bestMeal: Meal | null = null;
  let bestScore = -1;
  let bestAiScore: number | undefined;
  let bestUserScore: number | undefined;

  meals.forEach((meal) => {
    const rev = reviewMap.get(meal.date);
    const fb = feedbackMap.get(meal.date);
    const score = fb ? fb.score * 0.5 + (rev?.totalScore ?? fb.score) * 0.5 : (rev?.totalScore ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestMeal = meal;
      bestAiScore = rev?.totalScore;
      bestUserScore = fb?.score;
    }
  });

  if (bestMeal && bestScore > 0) {
    awards.push({
      type: "legend",
      title: "레전드 급식 🥇",
      subtitle: "이달의 최고 인기 식단",
      icon: "👑",
      badge: "이달의 1위",
      badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 ring-amber-300",
      date: (bestMeal as Meal).date,
      meal: bestMeal,
      aiScore: bestAiScore,
      userScore: bestUserScore,
      reason: bestUserScore
        ? `AI 평점 ${bestAiScore ?? "-"}점 & 내 평점 ${bestUserScore}점으로 최고 점수를 기록!`
        : `AI 평점 ${bestAiScore ?? "-"}점으로 최고 평가를 받았습니다.`,
    });
  }

  // 2. 💣 Disaster / Warning Meal (Lowest score)
  let worstMeal: Meal | null = null;
  let worstScore = 999;
  let worstAiScore: number | undefined;
  let worstUserScore: number | undefined;

  meals.forEach((meal) => {
    const rev = reviewMap.get(meal.date);
    const fb = feedbackMap.get(meal.date);
    if (rev || fb) {
      const score = fb ? fb.score * 0.5 + (rev?.totalScore ?? fb.score) * 0.5 : (rev?.totalScore ?? 50);
      if (score < worstScore) {
        worstScore = score;
        worstMeal = meal;
        worstAiScore = rev?.totalScore;
        worstUserScore = fb?.score;
      }
    }
  });

  if (worstMeal && worstScore < 999 && worstScore <= 75) {
    awards.push({
      type: "worst",
      title: "아쉬운 지뢰 급식 💣",
      subtitle: "개선이 필요했던 식단",
      icon: "🌪️",
      badge: "위험 식단",
      badgeClass: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 ring-rose-300",
      date: (worstMeal as Meal).date,
      meal: worstMeal,
      aiScore: worstAiScore,
      userScore: worstUserScore,
      reason: worstUserScore
        ? `내 체감 점수 ${worstUserScore}점으로 아쉬움이 컸던 식단입니다.`
        : `AI 평점 ${worstAiScore ?? "-"}점으로 구성의 조화가 아쉬웠던 날입니다.`,
    });
  }

  // 3. ⚡ Calorie / Nutrition Peak Champion
  let maxCalMeal: Meal | null = null;
  let maxCalories = 0;

  meals.forEach((meal) => {
    if (meal.calories) {
      const num = parseInt(meal.calories.replace(/[^\d]/g, ""), 10);
      if (!isNaN(num) && num > maxCalories) {
        maxCalories = num;
        maxCalMeal = meal;
      }
    }
  });

  if (maxCalMeal && maxCalories > 0) {
    awards.push({
      type: "calorie_champion",
      title: "칼로리 폭탄 챔피언 ⚡",
      subtitle: "최대 열량 & 에너지 충전의 날",
      icon: "🔥",
      badge: `${maxCalories} kcal`,
      badgeClass: "bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200 ring-orange-300",
      date: (maxCalMeal as Meal).date,
      meal: maxCalMeal,
      aiScore: reviewMap.get((maxCalMeal as Meal).date)?.totalScore,
      userScore: feedbackMap.get((maxCalMeal as Meal).date)?.score,
      reason: `한 끼 열량 ${maxCalories} kcal로 이달 가장 든든하고 강력했던 식단!`,
    });
  }

  // 4. ⭐ Favorite Peak Day (Day with most matched favorite keywords)
  if (favoriteKeywords.length > 0) {
    let peakFavMeal: Meal | null = null;
    let maxMatchCount = 0;
    let matchedKeywordsList: string[] = [];

    meals.forEach((meal) => {
      const matches = favoriteKeywords.filter((k) =>
        meal.menu.some((m) => m.toLowerCase().includes(k.toLowerCase())),
      );
      if (matches.length > maxMatchCount) {
        maxMatchCount = matches.length;
        peakFavMeal = meal;
        matchedKeywordsList = matches;
      }
    });

    if (peakFavMeal && maxMatchCount > 0) {
      awards.push({
        type: "favorite_peak",
        title: "최애 메뉴 풍년의 날 ⭐",
        subtitle: `최애 키워드 ${maxMatchCount}개 동시 출현`,
        icon: "✨",
        badge: `${matchedKeywordsList.join(", ")}`,
        badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 ring-amber-300",
        date: (peakFavMeal as Meal).date,
        meal: peakFavMeal,
        aiScore: reviewMap.get((peakFavMeal as Meal).date)?.totalScore,
        userScore: feedbackMap.get((peakFavMeal as Meal).date)?.score,
        reason: `내가 좋아하는 메뉴 [${matchedKeywordsList.join(", ")}]가 대거 쏟아진 축제의 날!`,
      });
    }
  }

  return awards;
}

/**
 * Calculates AI vs User taste compatibility and category stats.
 */
export function calculateTasteInsights(
  meals: Meal[],
  reviews: AiReview[],
  feedbacks: UserMealFeedback[],
) {
  const reviewMap = new Map<string, AiReview>();
  reviews.forEach((r) => reviewMap.set(r.date, r));

  let totalDiff = 0;
  let comparedCount = 0;
  let userMoreGenerousCount = 0;
  let aiMoreGenerousCount = 0;

  feedbacks.forEach((fb) => {
    const rev = reviewMap.get(fb.date);
    if (rev) {
      comparedCount++;
      const diff = Math.abs(fb.score - rev.totalScore);
      totalDiff += diff;
      if (fb.score > rev.totalScore) userMoreGenerousCount++;
      else if (rev.totalScore > fb.score) aiMoreGenerousCount++;
    }
  });

  const avgDiff = comparedCount > 0 ? totalDiff / comparedCount : 0;
  const matchPercentage = Math.max(10, Math.min(100, Math.round(100 - avgDiff)));

  let insightComment = "아직 비교할 데이터가 충분하지 않습니다. 급식을 먹고 체감 평가를 남겨보세요!";
  if (comparedCount >= 2) {
    if (matchPercentage >= 85) {
      insightComment = "AI 비평가와 나의 입맛 싱크로율이 찰떡궁합이에요! AI의 점수를 믿고 급식을 즐겨도 좋아요 🎯";
    } else if (userMoreGenerousCount > aiMoreGenerousCount) {
      insightComment = "나는 깐깐한 AI보다 음식에 대해 훨씬 관대하고 맛있게 즐기는 긍정 미식가 스타일이에요! 😋";
    } else {
      insightComment = "나는 AI보다 입맛 기준이 높고 엄격한 절대 미각 미식가 스타일이에요! 🧐";
    }
  }

  // Category statistics
  let meatCount = 0;
  let friedCount = 0;
  let noodleCount = 0;
  let dessertCount = 0;

  meals.forEach((meal) => {
    const text = meal.menu.join(" ");
    if (/고기|돈까스|제육|치킨|불고기|갈비|닭|돼지|소고기|함박|스테이크|삼겹살|오리/i.test(text)) {
      meatCount++;
    }
    if (/튀김|까스|카츠|치킨|너겟|탕수육|도넛|감자튀김/i.test(text)) {
      friedCount++;
    }
    if (/면|스파게티|파스타|우동|국수|짜장|짬뽕|라멘|마라탕|잡채/i.test(text)) {
      noodleCount++;
    }
    if (/와플|케이크|쿠키|푸딩|요구르트|주스|에이드|과일|바나나|사과|수박|딸기|아이스크림/i.test(text)) {
      dessertCount++;
    }
  });

  const totalMeals = Math.max(1, meals.length);
  const categories: DietCategoryStat[] = [
    {
      name: "육류/단백질",
      count: meatCount,
      percentage: Math.round((meatCount / totalMeals) * 100),
      icon: "🥩",
      colorClass: "bg-rose-500",
    },
    {
      name: "바삭 튀김류",
      count: friedCount,
      percentage: Math.round((friedCount / totalMeals) * 100),
      icon: "🍗",
      colorClass: "bg-amber-500",
    },
    {
      name: "면류/특식",
      count: noodleCount,
      percentage: Math.round((noodleCount / totalMeals) * 100),
      icon: "🍜",
      colorClass: "bg-indigo-500",
    },
    {
      name: "달콤 디저트",
      count: dessertCount,
      percentage: Math.round((dessertCount / totalMeals) * 100),
      icon: "🧁",
      colorClass: "bg-pink-500",
    },
  ];

  return {
    comparedCount,
    matchPercentage,
    insightComment,
    categories,
  };
}
