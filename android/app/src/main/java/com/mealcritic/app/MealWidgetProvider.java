package com.mealcritic.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MealWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "MealWidgetProvider";
    public static final String PREFS_NAME = "MealWidgetPrefs";

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        updateAllWidgets(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        if (appWidgetIds == null) return;
        for (int appWidgetId : appWidgetIds) {
            try {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            } catch (Exception e) {
                Log.e(TAG, "Error updating appWidgetId=" + appWidgetId, e);
            }
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String schoolName = prefs.getString("schoolName", "학교 미설정");
        String mealKind = prefs.getString("mealKind", "오늘 급식");
        String mealDate = prefs.getString("mealDate", "");
        String calories = prefs.getString("calories", "");
        String rawMenu = prefs.getString("menu", "");
        String favoritesStr = prefs.getString("favorites", "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.meal_widget);

        // School Name
        views.setTextViewText(R.id.widget_school_name, schoolName);

        // Meal Kind
        views.setTextViewText(R.id.widget_meal_kind, mealKind.isEmpty() ? "오늘 급식" : mealKind);

        // Calories
        if (!calories.isEmpty() && !calories.equals("칼로리 미등록")) {
            views.setTextViewText(R.id.widget_calories, calories);
            views.setViewVisibility(R.id.widget_calories, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_calories, View.GONE);
        }

        // Date text
        if (!mealDate.isEmpty()) {
            views.setTextViewText(R.id.widget_date_text, mealDate + " • Yami");
        } else {
            views.setTextViewText(R.id.widget_date_text, "Yami 급식평론가");
        }

        // Menu parsing & favorite highlighting
        boolean hasFavorite = false;
        if (!rawMenu.isEmpty()) {
            List<String> favList = new ArrayList<>();
            if (!favoritesStr.isEmpty()) {
                String[] favs = favoritesStr.split(",");
                for (String f : favs) {
                    String trimmed = f.trim().toLowerCase();
                    if (!trimmed.isEmpty()) {
                        favList.add(trimmed);
                    }
                }
            }

            // Split by comma or newline
            String[] items = rawMenu.split("[,\\n]");
            StringBuilder formattedMenu = new StringBuilder();

            int count = 0;
            for (String item : items) {
                String clean = item.replaceAll("\\([0-9.]+\\)", "").trim();
                if (clean.isEmpty()) continue;

                boolean isFav = false;
                for (String fav : favList) {
                    if (clean.toLowerCase().contains(fav) || fav.contains(clean.toLowerCase())) {
                        isFav = true;
                        hasFavorite = true;
                        break;
                    }
                }

                if (count > 0) {
                    formattedMenu.append("  •  ");
                }

                if (isFav) {
                    formattedMenu.append(clean).append("❤️");
                } else {
                    formattedMenu.append(clean);
                }
                count++;
            }

            if (formattedMenu.length() > 0) {
                views.setTextViewText(R.id.widget_menu_content, formattedMenu.toString());
            } else {
                views.setTextViewText(R.id.widget_menu_content, "등록된 식단이 없습니다.");
            }
        } else {
            views.setTextViewText(R.id.widget_menu_content, "앱을 열어 오늘의 급식을 확인하세요.");
        }

        // Favorite banner visibility
        views.setViewVisibility(R.id.widget_fav_banner, hasFavorite ? View.VISIBLE : View.GONE);

        // Launch app on widget click
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            Log.e(TAG, "Exception in updateAppWidget id=" + appWidgetId, e);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, MealWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int id : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, id);
            }
        }
    }
}
