export type MealKind = "breakfast" | "lunch" | "dinner";

export type School = {
  id: string;
  officeCode: string;
  schoolCode: string;
  name: string;
  address: string;
  kind: string;
};

export type MenuItem = {
  name: string;
  allergies: number[];
  raw: string;
};

export type Meal = {
  id: string;
  officeCode: string;
  schoolCode: string;
  schoolName: string;
  date: string;
  kind: MealKind;
  kindName: string;
  menu: string[];
  menuItems?: MenuItem[];
  rawMenu: string;
  calories?: string;
  nutrition?: string;
  origin?: string;
  updatedAt: number;
};

export type Criterion = {
  id: string;
  label: string;
  weight: number;
  enabled: boolean;
};

export type AiCriterionScore = {
  name: string;
  score: number;
  max: number;
  comment: string;
};

export type CriticPersonaId =
  | "student"
  | "paik"
  | "ramsay"
  | "dietitian"
  | "king"
  | "robot";

export type AiReview = {
  id: string;
  mealId: string;
  schoolCode: string;
  date: string;
  mealKind?: MealKind;
  totalScore: number;
  oneLine: string;
  detail: string;
  scores: AiCriterionScore[];
  customScores?: AiCriterionScore[];
  createdAt: number;
  model: string;
  persona?: CriticPersonaId;
  personaName?: string;
};

export type GeminiModelOption = {
  id: string;
  displayName: string;
  description?: string;
};

export type MenuReactionType = "👍" | "❤️" | "👎" | "🤢";

export type AppSettings = {
  geminiApiKey: string;
  geminiModel: string;
  availableGeminiModels?: GeminiModelOption[];
  neisApiKey: string;
  darkMode: boolean;
  themeColor: string;
  notificationsEnabled: boolean;
  notificationTime: string;
  selectedSchool?: School;
  userAllergies?: number[];
  preferredMealKind?: MealKind;
  favoriteKeywords?: string[];
  menuReactions?: Record<string, MenuReactionType>;
  keywordNotificationsEnabled?: boolean;
  criticPersona?: CriticPersonaId;
};

export type LoadState = "idle" | "loading" | "success" | "empty" | "error";

export type NeisMealRow = {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  MLSV_YMD: string;
  MMEAL_SC_NM: string;
  DDISH_NM: string;
  CAL_INFO?: string;
  NTR_INFO?: string;
  ORPLC_INFO?: string;
};

export type ScheduleEventType = "exam" | "vacation" | "holiday" | "festival" | "general";

export type SchoolScheduleEvent = {
  id: string;
  schoolCode: string;
  date: string; // YYYYMMDD
  eventName: string;
  eventContent?: string;
  gradeTarget?: string;
  dayType?: string;
  eventType: ScheduleEventType;
};

export type NeisSchoolScheduleRow = {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  AY?: string;
  AA_YMD: string;
  EVENT_NM: string;
  EVENT_CNTNT?: string;
  ONE_GRADE_EVENT_YN?: string;
  TW_GRADE_EVENT_YN?: string;
  THREE_GRADE_EVENT_YN?: string;
  FOUR_GRADE_EVENT_YN?: string;
  FIVE_GRADE_EVENT_YN?: string;
  SIX_GRADE_EVENT_YN?: string;
  SBTR_DD_SC_NM?: string;
};

export type UserMealReaction =
  | "delicious" // 존맛 😍
  | "good"      // 맛있음 👍
  | "soso"      // 무난 😐
  | "bad"       // 별로 🤢
  | "spicy"     // 매움 🔥
  | "little";   // 양적음 🤏

export type UserMealFeedback = {
  id: string; // `${schoolCode}-${date}-${kind}`
  mealId: string;
  schoolCode: string;
  date: string; // YYYYMMDD
  mealKind: MealKind;
  score: number; // 20, 40, 60, 80, 100
  reaction: UserMealReaction;
  comment?: string;
  createdAt: number;
};

export type MealAward = {
  type: "legend" | "worst" | "calorie_champion" | "favorite_peak";
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  badgeClass: string;
  date: string;
  meal: Meal;
  aiScore?: number;
  userScore?: number;
  reason: string;
};

export type DietCategoryStat = {
  name: string;
  count: number;
  percentage: number;
  icon: string;
  colorClass: string;
};
