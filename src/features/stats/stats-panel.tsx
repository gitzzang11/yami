"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { db } from "@/db/app-db";
import { scoreTone } from "@/lib/utils";
import type { AiReview } from "@/types";

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
    if (data.date && data.date.length === 4) {
      const month = parseInt(data.date.slice(0, 2), 10);
      const day = parseInt(data.date.slice(2), 10);
      formattedDate = `${month}월 ${day}일`;
    }

    return (
      <div
        className="rounded-2xl border border-zinc-200/30 bg-white/60 p-3 shadow-xl dark:border-white/10 dark:bg-black/40"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">{formattedDate} 급식</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-lg">{tone.emoji}</span>
          <span className={`text-base font-black ${tone.textClassName}`}>
            {score}점
          </span>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            ({tone.label})
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function StatsPanel() {
  const [reviews, setReviews] = useState<AiReview[]>([]);

  useEffect(() => {
    const since = Date.now() - 1000 * 60 * 60 * 24 * 30;
    db.reviews
      .where("createdAt")
      .aboveOrEqual(since)
      .reverse()
      .sortBy("createdAt")
      .then((items) => setReviews(items.reverse()));
  }, []);

  const stats = useMemo(() => {
    const scores = reviews.map((review) => review.totalScore);
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    return {
      average,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      ranking: [...reviews].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10),
    };
  }, [reviews]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["평균", stats.average],
          ["최고", stats.highest],
          ["최저", stats.lowest],
        ].map(([label, value]) => (
          <Card key={label} className="p-4 text-center">
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className={`mt-1 text-2xl font-black ${scoreTone(Number(value)).textClassName}`}>{value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>최근 30일 점수</CardTitle>
        <div className="mt-4 h-64">
          {reviews.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reviews.map((review) => ({ date: review.date.slice(4), score: review.totalScore }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(228, 228, 231, 0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }} axisLine={false} tickLine={false} width={25} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)", radius: 8 }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="var(--theme)" activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center rounded-3xl bg-white/60 text-sm font-semibold text-zinc-500 dark:bg-white/10">
              AI 평가를 실행하면 통계가 쌓입니다.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> 월간 급식 랭킹</CardTitle>
        <div className="mt-4 space-y-3">
          {stats.ranking.length ? stats.ranking.map((review, index) => (
            <div key={review.id} className="flex items-center gap-3 rounded-3xl bg-white/60 p-4 dark:bg-white/10">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-950 text-sm font-black text-white dark:bg-white dark:text-zinc-950">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-black">{review.oneLine}</div>
                <div className="text-xs text-zinc-500">{review.date}</div>
              </div>
              <div className={`text-xl font-black ${scoreTone(review.totalScore).textClassName}`}>{review.totalScore}</div>
            </div>
          )) : <p className="text-sm text-zinc-500">랭킹 데이터가 없습니다.</p>}
        </div>
      </Card>
    </div>
  );
}
