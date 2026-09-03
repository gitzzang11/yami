"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, Sparkles, Trophy, Utensils } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { db } from "@/db/app-db";
import { scoreTone } from "@/lib/utils";
import { calculateMealAwards, calculateTasteInsights } from "@/services/feedback";
import { useAppStore } from "@/stores/app-store";
import type { AiReview, Meal, UserMealFeedback } from "@/types";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      score: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const score = data.score;
    const tone = scoreTone(score);

    let formattedDate = data.date;
    if (data.date && data.date.length === 8) {
      const month = parseInt(data.date.slice(4, 6), 10);
      const day = parseInt(data.date.slice(6, 8), 10);
      formattedDate = `${month}월 ${day}일`;
    } else if (data.date && data.date.length === 4) {
      const month = parseInt(data.date.slice(0, 2), 10);
      const day = parseInt(data.date.slice(2), 10);
      formattedDate = `${month}월 ${day}일`;
    }

    return (
      <div
        className="rounded-2xl border border-zinc-200/30 bg-white/80 p-3 shadow-xl dark:border-white/10 dark:bg-black/60"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">{formattedDate} 급식</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-lg">{tone.emoji}</span>
          <span className={`text-base font-black ${tone.textClassName}`}>{score}점</span>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">({tone.label})</span>
        </div>
      </div>
    );
  }
  return null;
}

function formatShortDate(dateStr: string) {
  if (dateStr.length === 8) {
    return `${parseInt(dateStr.slice(4, 6), 10)}월 ${parseInt(dateStr.slice(6, 8), 10)}일`;
  }
  return dateStr;
}

export function StatsPanel() {
  const { settings } = useAppStore();
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserMealFeedback[]>([]);

  useEffect(() => {
    let active = true;
    if (!settings.selectedSchool) {
      const timer = window.setTimeout(() => {
        if (active) {
          setReviews([]);
          setMeals([]);
          setFeedbacks([]);
        }
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    const schoolCode = settings.selectedSchool.schoolCode;
    const since = Date.now() - 1000 * 60 * 60 * 24 * 30;

    Promise.all([
      db.reviews
        .where("schoolCode")
        .equals(schoolCode)
        .filter((r) => r.createdAt >= since)
        .sortBy("createdAt"),
      db.meals
        .where("schoolCode")
        .equals(schoolCode)
        .toArray(),
      db.userFeedbacks
        .where("schoolCode")
        .equals(schoolCode)
        .toArray(),
    ]).then(([fetchedReviews, fetchedMeals, fetchedFeedbacks]) => {
      if (active) {
        setReviews(fetchedReviews);
        setMeals(fetchedMeals);
        setFeedbacks(fetchedFeedbacks);
      }
    });

    return () => {
      active = false;
    };
  }, [settings.selectedSchool]);

  const stats = useMemo(() => {
    const scores = reviews.map((review) => review.totalScore);
    const average = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    const userScores = feedbacks.map((f) => f.score);
    const userAvg = userScores.length
      ? Math.round(userScores.reduce((sum, s) => sum + s, 0) / userScores.length)
      : 0;

    return {
      average,
      userAvg,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      ranking: [...reviews].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10),
    };
  }, [reviews, feedbacks]);

  const awards = useMemo(() => {
    return calculateMealAwards(
      meals,
      reviews,
      feedbacks,
      settings.favoriteKeywords ?? [],
    );
  }, [meals, reviews, feedbacks, settings.favoriteKeywords]);

  const tasteInsights = useMemo(() => {
    return calculateTasteInsights(meals, reviews, feedbacks);
  }, [meals, reviews, feedbacks]);

  return (
    <div className="space-y-5">
      {/* 🎯 마일스톤 온보딩 프로그레스 배너 (평가 3회 미만일 때) */}
      {reviews.length < 3 && (
        <Card className="border-amber-300/80 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent p-4 space-y-2.5 dark:border-amber-800/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                  급식 통계 마일스톤 ({reviews.length}/3회 완료)
                </h3>
                <p className="text-2xs text-zinc-600 dark:text-zinc-400">
                  {3 - reviews.length}번 더 AI 평가를 진행하면 통계 분석과 랭킹의 신뢰도가 대폭 높아집니다!
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
              {Math.round((reviews.length / 3) * 100)}%
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${Math.max(12, (reviews.length / 3) * 100)}%` }}
            />
          </div>
        </Card>
      )}

      {/* 주요 통계 카드 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">AI 평균 평점</div>
          <div className={`mt-1 text-2xl font-black whitespace-nowrap ${scoreTone(stats.average).textClassName}`}>
            {stats.average > 0 ? `${stats.average}점` : "-"}
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">내 체감 평균</div>
          <div className="mt-1 text-2xl font-black text-[var(--theme)] whitespace-nowrap">
            {stats.userAvg > 0 ? `${stats.userAvg}점` : "-"}
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">최고 점수</div>
          <div className={`mt-1 text-2xl font-black whitespace-nowrap ${scoreTone(stats.highest).textClassName}`}>
            {stats.highest > 0 ? `${stats.highest}점` : "-"}
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">최저 점수</div>
          <div className={`mt-1 text-2xl font-black whitespace-nowrap ${scoreTone(stats.lowest).textClassName}`}>
            {stats.lowest > 0 ? `${stats.lowest}점` : "-"}
          </div>
        </Card>
      </div>

      {/* 🏆 주간/월간 급식 어워즈 (명예의 전당) */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 whitespace-nowrap">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" /> 급식 어워즈 (명예의 전당)
          </CardTitle>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-2xs font-black text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30 whitespace-nowrap shrink-0">
            Hall of Fame
          </span>
        </div>

        {awards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {awards.map((award) => (
              <div
                key={award.type + award.date}
                className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/60 dark:bg-white/5 dark:ring-white/10 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{award.icon}</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate">
                        {award.title}
                      </h4>
                      <p className="text-2xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        {formatShortDate(award.date)} • {award.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-black ring-1 whitespace-nowrap ${award.badgeClass}`}
                  >
                    {award.badge}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {award.meal.menu.slice(0, 5).map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-2 py-0.5 text-2xs font-bold text-zinc-700 shadow-2xs dark:bg-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0"
                    >
                      {item}
                    </span>
                  ))}
                  {award.meal.menu.length > 5 && (
                    <span className="text-2xs font-bold text-zinc-400 self-center whitespace-nowrap shrink-0">
                      +{award.meal.menu.length - 5}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed bg-white/60 dark:bg-black/20 rounded-xl p-2.5 break-keep">
                  {award.reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-28 place-items-center rounded-2xl bg-zinc-50/60 text-xs font-semibold text-zinc-500 dark:bg-white/5 break-keep text-center px-4">
            급식 데이터가 쌓이면 이달의 레전드 및 챔피언 급식이 선정됩니다.
          </div>
        )}
      </Card>

      {/* 🤖 AI vs 👤 내 입맛 싱크로율 & 취향 분석 */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" /> AI vs 내 입맛 싱크로율
          </CardTitle>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-2xs font-black text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/30 whitespace-nowrap shrink-0">
            {tasteInsights.comparedCount}회 비교
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              입맛 일치율 (Taste Match)
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
              {tasteInsights.comparedCount > 0 ? `${tasteInsights.matchPercentage}%` : "-"}
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{
                width: `${tasteInsights.comparedCount > 0 ? tasteInsights.matchPercentage : 0}%`,
              }}
            />
          </div>

          <p className="rounded-2xl bg-indigo-50/60 p-3.5 text-xs font-semibold text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-200 leading-relaxed break-keep">
            {tasteInsights.insightComment}
          </p>
        </div>
      </Card>

      {/* 📊 식단 인텔리전스 (카테고리별 출현 빈도) */}
      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2 whitespace-nowrap">
          <Utensils className="h-5 w-5 text-[var(--theme)] shrink-0" /> 식단 구성 인텔리전스
        </CardTitle>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tasteInsights.categories.map((cat) => (
            <div
              key={cat.name}
              className="rounded-2xl bg-zinc-50/80 p-3.5 dark:bg-white/5 ring-1 ring-zinc-200/50 dark:ring-white/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl shrink-0">{cat.icon}</span>
                <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {cat.count}일 출현
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{cat.name}</div>
                <div className="mt-0.5 text-lg font-black whitespace-nowrap">{cat.percentage}%</div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${cat.colorClass}`}
                  style={{ width: `${Math.min(100, cat.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 최근 30일 점수 트렌드 차트 */}
      <Card>
        <CardTitle>최근 30일 점수 트렌드</CardTitle>
        <div className="mt-4 h-64">
          {reviews.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reviews.map((review) => ({
                  date: review.date.slice(4),
                  score: review.totalScore,
                }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(228, 228, 231, 0.15)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)", radius: 8 }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="var(--theme)" activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center rounded-3xl bg-white/60 text-sm font-semibold text-zinc-500 dark:bg-white/10">
              AI 평가를 실행하면 점수 트렌드가 쌓입니다.
            </div>
          )}
        </div>
      </Card>

      {/* 월간 급식 랭킹 */}
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" /> 월간 급식 랭킹
        </CardTitle>
        <div className="mt-4 space-y-3">
          {stats.ranking.length ? (
            stats.ranking.map((review, index) => (
              <div
                key={review.id}
                className="flex items-center gap-3 rounded-3xl bg-white/60 p-4 dark:bg-white/10 shadow-2xs"
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                    index === 0
                      ? "bg-amber-400 text-amber-950 shadow-sm ring-2 ring-inset ring-amber-300"
                      : index === 1
                        ? "bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                        : index === 2
                          ? "bg-amber-700 text-amber-100"
                          : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">{review.oneLine}</div>
                  <div className="text-xs text-zinc-500">{formatShortDate(review.date)}</div>
                </div>
                <div className={`text-xl font-black ${scoreTone(review.totalScore).textClassName}`}>
                  {review.totalScore}점
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">랭킹 데이터가 없습니다.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
