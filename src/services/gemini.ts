import { db } from "@/db/app-db";
import type { AiReview, Criterion, Meal } from "@/types";

const SCORE_SCHEMA = [
  { name: "맛과 조화", max: 30 },
  { name: "트렌드와 선호도", max: 25 },
  { name: "영양 균형", max: 15 },
  { name: "메뉴 다양성", max: 10 },
  { name: "구성 완성도", max: 10 },
  { name: "특별성", max: 10 },
];

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  return JSON.parse(raw);
}

function clampScore(value: unknown, max: number) {
  const number = Number(value);
  if (Number.isNaN(number)) return Math.round(max * 0.7);
  return Math.max(0, Math.min(max, Math.round(number)));
}

export async function evaluateMealWithGemini(
  meal: Meal,
  criteria: Criterion[],
  apiKey: string,
  model: string,
): Promise<AiReview> {
  if (!apiKey.trim()) {
    throw new Error("Gemini API Key를 설정에서 입력해야 AI 평가를 실행할 수 있습니다.");
  }

  const activeCriteria = criteria
    .filter((criterion) => criterion.enabled)
    .map((criterion) => `- ${criterion.label}: 가중치 ${criterion.weight.toFixed(1)}`)
    .join("\n");

  const prompt = [
    "당신은 대한민국 최고의 급식 비평가이자 전문 셰프입니다.",
    "아래 학교 급식을 고등학생 관점에서 냉정하지만 유쾌하게 평가하세요.",
    "반드시 JSON 객체만 출력하세요. 마크다운, 설명문, 코드블록은 출력하지 마세요.",
    "JSON 스키마:",
    '{"totalScore": number, "oneLine": "35자 이하", "detail": "상세 평가", "scores": [{"name": string, "score": number, "max": number, "comment": string}]}',
    "평가 항목과 만점: 맛과 조화 30점, 트렌드와 선호도 25점, 영양 균형 15점, 메뉴 다양성 10점, 구성 완성도 10점, 특별성 10점.",
    `커스텀 선호 기준:\n${activeCriteria || "- 없음"}`,
    `급식 날짜: ${meal.date}`,
    `메뉴: ${meal.menu.join(", ")}`,
    `칼로리: ${meal.calories ?? "정보 없음"}`,
    `영양정보: ${meal.nutrition ?? "정보 없음"}`,
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.55,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini 평가 요청에 실패했습니다. ${message.slice(0, 120)}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  let parsed: {
    totalScore?: number;
    oneLine?: string;
    detail?: string;
    scores?: { name?: string; score?: number; max?: number; comment?: string }[];
  };
  try {
    parsed = extractJson(text);
  } catch {
    parsed = {
      totalScore: 70,
      oneLine: "평가는 도착했지만 형식이 흔들렸어요",
      detail: text.slice(0, 600),
      scores: SCORE_SCHEMA.map((item) => ({
        ...item,
        score: Math.round(item.max * 0.7),
        comment: "응답 파싱 실패로 보수 점수를 적용했습니다.",
      })),
    };
  }

  const scores = SCORE_SCHEMA.map((schema) => {
    const found = parsed.scores?.find((score) => score.name === schema.name);
    return {
      name: schema.name,
      max: schema.max,
      score: clampScore(found?.score, schema.max),
      comment: found?.comment || "항목 평가가 제공되지 않았습니다.",
    };
  });
  const totalScore = clampScore(
    parsed.totalScore ?? scores.reduce((sum, item) => sum + item.score, 0),
    100,
  );

  const review: AiReview = {
    id: `${meal.id}-${Date.now()}`,
    mealId: meal.id,
    date: meal.date,
    totalScore,
    oneLine: (parsed.oneLine || "오늘 급식은 균형감 있게 무난해요").slice(0, 35),
    detail: parsed.detail || "상세 평가가 제공되지 않았습니다.",
    scores,
    createdAt: Date.now(),
    model,
  };
  await db.reviews.put(review);
  return review;
}

export async function getLatestReview(mealId: string) {
  return db.reviews.where("mealId").equals(mealId).last();
}
