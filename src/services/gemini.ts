import { db } from "@/db/app-db";
import type { AiReview, Criterion, CriticPersonaId, GeminiModelOption, Meal, MealKind } from "@/types";

export type CriticPersona = {
  id: CriticPersonaId;
  name: string;
  icon: string;
  title: string;
  badge: string;
  shortDesc: string;
  sampleQuote: string;
  systemPrompt: (schoolKind?: string) => string;
};

export const CRITIC_PERSONAS: Record<CriticPersonaId, CriticPersona> = {
  student: {
    id: "student",
    name: "솔직한 학생",
    icon: "🎓",
    title: "솔직한 학생 비평가",
    badge: "🎓 학생 비평단",
    shortDesc: "학교급별(초·중·고) 맞춤 학생 시각의 솔직담백한 평가",
    sampleQuote: "오늘 돈까스 두께 대박... 이 메뉴면 야자 10시까지 쌉가능!",
    systemPrompt: (schoolKind) => {
      if (schoolKind?.includes("초등")) {
        return "당신은 초등학생의 눈높이에서 평가하는 솔직하고 귀여운 급식 평가단입니다. 달콤한 디저트와 맛있는 반찬을 좋아하고, 매운맛이나 쓴맛에는 솔직하게 반응하며, 아기자기하고 친근한 말투로 평가하세요.";
      }
      if (schoolKind?.includes("중등") || schoolKind?.includes("중학")) {
        return "당신은 한창 식욕 왕성하고 맵단짠과 마라, 치킨 등 트렌디한 메뉴를 사랑하는 중학생 급식 비평가입니다. 솔직하고 에너지 넘치며 직설적인 유행어와 10대 감성 입맛으로 평가하세요.";
      }
      return "당신은 학업 스트레스와 야간 자율학습에 지친 고등학생 급식 비평가입니다. 든든한 포만감과 단백질, 피로를 날려줄 맛있는 특식을 중시하며, 냉정하지만 위트 있는 10대 말투로 평가하세요.";
    },
  },
  paik: {
    id: "paik",
    name: "백종원 셰프",
    icon: "👨‍🍳",
    title: "구수한 요리연구가 백종원",
    badge: "👨‍🍳 백종원 셰프 모드",
    shortDesc: "구수한 충청도 사투리와 침샘 자극 솔루션",
    sampleQuote: "이야~ 오늘 제육 양념이 기가 막히네유! 밥 두 공기 뚝딱이쥬~",
    systemPrompt: () =>
      "당신은 대한민국 대표 외식 전문가 백종원 셰프입니다. 구수하고 친근한 충청도 사투리(~유, ~쥬, 이야기, 그쥬?, 쥑이네)를 듬뿍 사용하며, 재료의 불맛과 양념의 조화, 밥도둑 메뉴 조합에 감탄하고 때로는 전문적인 꿀팁 솔루션을 친근하게 제안하세요. 한줄평과 상세 비평 모두 백종원 셰프 특유의 말투가 확연히 드러나야 합니다.",
  },
  ramsay: {
    id: "ramsay",
    name: "고든 램지",
    icon: "🤬",
    title: "미슐랭 3스타 고든 램지",
    badge: "🤬 고든 램지 모드",
    shortDesc: "매운맛 독설 혹평과 감탄할 때 터지는 극찬(Stunning!)",
    sampleQuote: "이 샐러드는 너무 생생해서 아직 밭으로 기어가겠어!! 완벽한 조화(Stunning)!",
    systemPrompt: () =>
      "당신은 세계적인 미슐랭 3스타 셰프 고든 램지(Gordon Ramsay)입니다. 식재료의 퀄리티, 조리 상태, 플레이팅과 밸런스에 대해 타협 없이 매우 직설적이고 날카로운 독설 혹평을 내리거나, 훌륭한 메뉴에는 전율하는 극찬('Stunning!', 'Incredible!', 'Disaster!')을 한국어로 쏟아내세요. 비평의 에너지가 불꽃처럼 강렬해야 합니다.",
  },
  dietitian: {
    id: "dietitian",
    name: "영양사 선생님",
    icon: "👩‍🏫",
    title: "다정한 영양사 선생님",
    badge: "👩‍🏫 영양사 선생님 모드",
    shortDesc: "탄단지 영양 밸런스와 비타민, 정성 어린 격려와 피드백",
    sampleQuote: "성장기 필수 단백질과 비타민이 골고루! 시금치도 남기지 마세요~",
    systemPrompt: () =>
      "당신은 학생들의 건강과 성장을 진심으로 아끼는 학교 영양사 선생님입니다. 탄수화물·단백질·지방의 황금 비율, 비타민과 무기질, 제철 식재료의 효능을 칭찬하며, 편식하지 말고 골고루 먹도록 다정하고 따뜻하게 격려하는 말투(~해요, ~랍니다, 참 잘했어요)로 평가하세요.",
  },
  king: {
    id: "king",
    name: "조선시대 임금님",
    icon: "👑",
    title: "수라간 미식가 임금님",
    badge: "👑 수라간 임금님 모드",
    shortDesc: "근엄하고 고풍스러운 조선 왕실 궁중 미식 평론",
    sampleQuote: "과인의 입맛을 사로잡았도다! 수라간 영양사에게 후한 상을 내리라.",
    systemPrompt: () =>
      "당신은 조선시대 궁궐에서 매일 수라상을 받는 지엄하고 미식에 조예가 깊은 임금님입니다. 근엄하고 고풍스러운 궁중 어투(~하였도다, ~로다, 과인은, 상을 내리라, 어찌 이리 부실한가)를 사용하며, 식단을 임금의 수라상 찬품으로 비유하여 품격 있고 위엄 있게 평가하세요.",
  },
  robot: {
    id: "robot",
    name: "냉철한 AI 분석관",
    icon: "🤖",
    title: "알고리즘 AI 분석관",
    badge: "🤖 AI 분석관 모드",
    shortDesc: "수치·데이터·열량 알고리즘 중심의 초정밀 기계적 분석",
    sampleQuote: "[분석 완료] 단백질 충족률 96.4%. 미각 수용체 만족도 최상급 판정.",
    systemPrompt: () =>
      "당신은 감정을 배제하고 순수 영양학적 데이터, 분자 단위의 맛 알고리즘, 칼로리 대비 열량 효율을 계산하는 미래형 슈퍼 AI 분석관입니다. 기계적이고 정밀한 어조('[시스템]', '수치 연산 완료:', '확률:', '판정:')를 사용하여 컴퓨터 로그처럼 냉철하게 평가하세요.",
  },
};

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  initialDelayMs = 1200,
): Promise<Response> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 503) {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("요청 재시도 횟수를 초과했습니다.");
}

export async function evaluateMealWithGemini(
  meal: Meal,
  criteria: Criterion[],
  apiKey: string,
  model: string,
  schoolKind?: string,
  personaId: CriticPersonaId = "student",
): Promise<AiReview> {
  if (!apiKey.trim()) {
    throw new Error("Gemini API Key를 설정에서 입력해야 AI 평가를 실행할 수 있습니다.");
  }

  const activeCriteria = criteria
    .filter((criterion) => criterion.enabled)
    .map((criterion) => `- ${criterion.label}: 가중치 ${criterion.weight.toFixed(1)}`)
    .join("\n");

  const activePersona = CRITIC_PERSONAS[personaId] || CRITIC_PERSONAS.student;
  const personaInstruction = activePersona.systemPrompt(schoolKind);

  const prompt = [
    personaInstruction,
    "★ [평가 중요 수칙 - 점수 다양성 극대화]:",
    "- 평가 점수(totalScore 및 각 세부 항목 점수)가 평범한 70~80점대 주변으로만 수렴하면 비평가로서 실격입니다.",
    "- 메뉴 구성이 부실하거나, 조화가 깨지거나, 영양 불균형이 심한 날은 가차 없이 30점~50점대의 매서운 혹평을 내리세요.",
    "- 영양 배치가 훌륭하고 트렌디한 메뉴 구성이거나, 보기만 해도 군침이 도는 훌륭한 특식이 나온 날은 아낌없이 90점~98점대의 높은 극찬 점수를 부여하세요.",
    "- 점수의 폭(30점대부터 90점대 후반까지)을 과감하고 예리하게 다변화하여 비평의 개성을 드러내세요.",
    `[당신의 역할 페르소나]: ${activePersona.title} (${activePersona.shortDesc})`,
    `한줄평(oneLine)과 상세 비평(detail)은 반드시 위 페르소나의 대표적인 어투와 성격을 완벽하게 반영하여 작성하세요.`,
    "평가 항목과 만점: 맛과 조화 30점, 트렌드와 선호도 25점, 영양 균형 15점, 메뉴 다양성 10점, 구성 완성도 10점, 특별성 10점.",
    `커스텀 선호 기준(활성화된 각 항목을 10점 만점으로 별도 평가하고 가중치를 코멘트에 언급하세요):\n${activeCriteria || "- 없음"}`,
    "주의: 커스텀 선호 기준이 제공된 경우, 제공된 각 항목명(label)을 customScores 배열의 name으로 맵핑하여 10점 만점 기준 점수와 가중치 언급 코멘트를 작성하세요. 기준이 없다면 customScores는 빈 배열로 반환하세요.",
    `급식 날짜: ${meal.date}`,
    `식사 종류: ${meal.kindName || meal.kind}`,
    `메뉴: ${meal.menu.join(", ")}`,
    `칼로리: ${meal.calories ?? "정보 없음"}`,
    `영양정보: ${meal.nutrition ?? "정보 없음"}`,
  ].join("\n\n");

  const responseSchema = {
    type: "OBJECT",
    properties: {
      totalScore: { type: "INTEGER", description: "0~100 사이의 총점" },
      oneLine: { type: "STRING", description: "45자 이내의 위트 있고 직관적인 한줄평 (페르소나 특유의 어조 반영)" },
      detail: { type: "STRING", description: "식단 구성과 맛의 조화에 대한 상세 비평 (페르소나 특유의 어조 반영)" },
      scores: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            score: { type: "INTEGER" },
            max: { type: "INTEGER" },
            comment: { type: "STRING" },
          },
          required: ["name", "score", "max", "comment"],
        },
      },
      customScores: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            score: { type: "INTEGER" },
            max: { type: "INTEGER" },
            comment: { type: "STRING" },
          },
          required: ["name", "score", "max", "comment"],
        },
      },
    },
    required: ["totalScore", "oneLine", "detail", "scores"],
  };

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let message = response.statusText;
    try {
      const errJson = JSON.parse(errorText);
      message = errJson.error?.message || message;
    } catch {
      message = errorText.slice(0, 120);
    }
    if (response.status === 429) {
      throw new Error("Gemini API 무료 요청 한도를 초과했습니다. 잠시 후(약 1분 뒤) 다시 시도해 주세요.");
    }
    throw new Error(`Gemini 평가 요청 실패 (${message})`);
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
    schoolCode: meal.schoolCode,
    date: meal.date,
    mealKind: meal.kind,
    totalScore,
    oneLine: (parsed.oneLine || "오늘 급식은 균형감 있게 무난해요").slice(0, 45),
    detail: parsed.detail || "상세 평가가 제공되지 않았습니다.",
    scores,
    customScores,
    createdAt: Date.now(),
    model,
    persona: activePersona.id,
    personaName: activePersona.name,
  };
  await db.reviews.put(review);
  return review;
}

export async function getLatestReview(
  mealId: string,
  schoolCode?: string,
  date?: string,
  kind?: MealKind,
): Promise<AiReview | undefined> {
  if (schoolCode && date) {
    const reviews = await db.reviews
      .where("schoolCode")
      .equals(schoolCode)
      .filter((r) => r.date === date && (!kind || !r.mealKind || r.mealKind === kind))
      .sortBy("createdAt");
    if (reviews.length > 0) {
      return reviews[reviews.length - 1];
    }
  }

  const byMealId = await db.reviews.where("mealId").equals(mealId).sortBy("createdAt");
  if (byMealId.length > 0) {
    return byMealId[byMealId.length - 1];
  }
  return undefined;
}
