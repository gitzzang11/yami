import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Meal, School } from "@/types";
import { formatKoreanDate } from "@/lib/utils";

interface WidgetBridgePlugin {
  updateMealWidget(options: {
    schoolName: string;
    mealKind: string;
    mealDate: string;
    calories: string;
    menu: string;
    favorites: string;
  }): Promise<{ success: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

function parseDateStr(dateStr?: string): Date {
  if (dateStr && dateStr.length === 8) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    return new Date(y, m, d);
  }
  return new Date();
}

/**
 * Android 홈 화면 위젯에 오늘 급식 정보와 최애 키워드를 동기화합니다.
 */
export async function syncMealWidget(
  school?: School | null,
  meal?: Meal | null,
  favoriteKeywords: string[] = [],
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return false;
  }

  try {
    const schoolName = school?.name ?? meal?.schoolName ?? "학교 미설정";
    const mealKind = meal?.kindName ? `오늘 ${meal.kindName}` : "오늘 급식";
    const mealDate = meal?.date ? formatKoreanDate(parseDateStr(meal.date)) : "";
    const calories = meal?.calories ?? "";
    const menu = meal?.menu ? meal.menu.join(", ") : "";
    const favorites = favoriteKeywords.join(", ");

    await WidgetBridge.updateMealWidget({
      schoolName,
      mealKind,
      mealDate,
      calories,
      menu,
      favorites,
    });
    return true;
  } catch (error) {
    console.warn("위젯 동기화 실패 (무시 가능):", error);
    return false;
  }
}
