import { db } from "@/db/app-db";
import type { AiReview, Criterion, GeminiModelOption, Meal } from "@/types";

export const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
  { id: "gemini-3.5-flash", displayName: "gemini-3.5-flash" },
  { id: "gemini-3.5-pro", displayName: "gemini-3.5-pro" },
  { id: "gemini-3.1-flash-lite", displayName: "gemini-3.1-flash-lite" },
  { id: "gemini-2.5-flash", displayName: "gemini-2.5-flash" },
  { id: "gemini-2.5-pro", displayName: "gemini-2.5-pro" },
  { id: "gemma-4-26b", displayName: "Gemma 4 26B" },
  { id: "gemma-4-31b", displayName: "Gemma 4 31B" },
];

export async function fetchAvailableGeminiModels(apiKey: string): Promise<GeminiModelOption[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Gemini API Key를 입력해주세요.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let message = response.statusText;
    try {
      const errJson = JSON.parse(errorText);
      message = errJson.error?.message || message;
    } catch {
      message = errorText.slice(0, 100);
    }
    throw new Error(`모델 목록을 가져오지 못했습니다 (${message})`);
  }

  const payload = await response.json();
  if (!payload.models || !Array.isArray(payload.models)) {
    throw new Error("올바른 모델 응답을 수신하지 못했습니다.");
  }

  const models: GeminiModelOption[] = (payload.models as Array<{
    name?: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
  }>)
    .filter((m) => {
      return (
        typeof m.name === "string" &&
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
      );
    })
    .map((m) => {
      const id = m.name!.replace(/^models\//, "");
      return {
        id,
        displayName: m.displayName || id,
        description: m.description,
      };
    });

  // Sort: Gemini models first, then Gemma, then others
  models.sort((a, b) => {
    const isGeminiA = a.id.toLowerCase().startsWith("gemini");
    const isGeminiB = b.id.toLowerCase().startsWith("gemini");
    if (isGeminiA && !isGeminiB) return -1;
    if (!isGeminiA && isGeminiB) return 1;
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
  });

  return models;
}

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
  schoolKind?: string,
): Promise<AiReview> {
  if (!apiKey.trim()) {
    throw new Error("Gemini API Key를 설정에서 입력해야 AI 평가를 실행할 수 있습니다.");
  }

  const activeCriteria = criteria
    .filter((criterion) => criterion.enabled)
    .map((criterion) => `- ${criterion.label}: 가중치 ${criterion.weight.toFixed(1)}`)
    .join("\n");

  let persona = "고등학생 관점에서 냉정하지만 유쾌하게";
  let nutritionTip = "학업 스트레스를 풀어줄 수 있는 든든하고 맛있는 급식인지, 밤늦게 자율학습까지 버틸 수 있는 풍성함이 있는지 중점적으로 봅니다.";

  if (schoolKind?.includes("초등")) {
    persona = "초등학생 관점에서 순수하고 유쾌하게";
    nutritionTip = "매운 맛의 강도가 적절한지, 성장기 아이들의 영양 균형에 맞춘 아기자기하고 자극적이지 않으면서 맛있는 급식인지 중점적으로 봅니다. 말투는 조금 더 친근하고 부드럽게 평가하세요.";
  } else if (schoolKind?.includes("중등") || schoolKind?.includes("중학")) {
    persona = "중학생 관점에서 에너제틱하고 솔직하게";
    nutritionTip = "한창 활동량이 많고 자극적인 맛(단짠, 마라 등)과 트렌디한 메뉴를 선호하는 중학생의 입맛에 부합하는지, 배부르게 먹을 수 있는 양인지 중점적으로 봅니다.";
  }

  const prompt = [
    "당신은 대한민국 최고의 급식 비평가이자 전문 셰프입니다.",
    "★ [평가 중요 수칙 - 점수 다양성 극대화]:",
    "- 평가 점수(totalScore 및 각 세부 항목 점수)가 평범한 70~80점대 주변으로만 수렴하면 비평가로서 실격입니다.",
    "- 메뉴 구성이 부실하거나, 조화가 깨지거나, 영양 불균형이 심한 날은 가차 없이 30점~50점대의 매서운 혹평을 내리세요.",
    "- 영양 배치가 훌륭하고 트렌디한 메뉴 구성이거나, 보기만 해도 군침이 도는 훌륭한 특식이 나온 날은 아낌없이 90점~98점대의 높은 극찬 점수를 부여하세요.",
    "- 점수의 폭(30점대부터 90점대 후반까지)을 과감하고 예리하게 다변화하여 비평의 개성을 드러내세요.",
    `아래 학교 급식을 ${persona} 평가하세요.`,
    "반드시 JSON 객체만 출력하세요. 마크다운, 설명문, 코드블록은 출력하지 마세요.",
    "JSON 스키마:",
    '{"totalScore": number, "oneLine": "35자 이하", "detail": "상세 평가", "scores": [{"name": string, "score": number, "max": number, "comment": string}], "customScores": [{"name": string, "score": number, "max": number, "comment": string}]}',
    "평가 항목과 만점: 맛과 조화 30점, 트렌드와 선호도 25점, 영양 균형 15점, 메뉴 다양성 10점, 구성 완성도 10점, 특별성 10점.",
    `커스텀 선호 기준(활성화된 각 항목을 10점 만점으로 별도 평가하고 가중치를 코멘트에 언급하세요):\n${activeCriteria || "- 없음"}`,
    "주의: 커스텀 선호 기준이 제공된 경우, 제공된 각 항목명(label)을 customScores 배열의 name으로 맵핑하여 10점 만점 기준 점수와 가중치 언급 코멘트를 반드시 작성하세요. 기준이 없다면 customScores는 빈 배열로 반환하세요.",
    `평가 시 고려사항: ${nutritionTip}`,
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
          temperature: 0.82,
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
    customScores?: { name?: string; score?: number; max?: number; comment?: string }[];
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
      customScores: [],
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

  const activeCriteriaList = criteria.filter((criterion) => criterion.enabled);
  const customScores = activeCriteriaList.map((criterion) => {
    const found = parsed.customScores?.find((score) => score.name === criterion.label);
    return {
      name: criterion.label,
      max: 10,
      score: clampScore(found?.score ?? 7, 10),
      comment: found?.comment || `가중치 ${criterion.weight.toFixed(1)} 기준에 대해 적절히 반영되었습니다.`,
    };
  });

  const review: AiReview = {
    id: `${meal.id}-${Date.now()}`,
    mealId: meal.id,
    date: meal.date,
    totalScore,
    oneLine: (parsed.oneLine || "오늘 급식은 균형감 있게 무난해요").slice(0, 35),
    detail: parsed.detail || "상세 평가가 제공되지 않았습니다.",
    scores,
    customScores,
    createdAt: Date.now(),
    model,
  };
  await db.reviews.put(review);
  return review;
}

export async function getLatestReview(mealId: string) {
  return db.reviews.where("mealId").equals(mealId).last();
}
