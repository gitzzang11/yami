export type MealKind = "breakfast" | "lunch" | "dinner";

export type School = {
  id: string;
  officeCode: string;
  schoolCode: string;
  name: string;
  address: string;
  kind: string;
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

export type AiReview = {
  id: string;
  mealId: string;
  date: string;
  totalScore: number;
  oneLine: string;
  detail: string;
  scores: AiCriterionScore[];
  createdAt: number;
  model: string;
};

export type AppSettings = {
  geminiApiKey: string;
  geminiModel: string;
  neisApiKey: string;
  darkMode: boolean;
  themeColor: string;
  notificationsEnabled: boolean;
  notificationTime: string;
  selectedSchool?: School;
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
