package com.mealcritic.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void updateMealWidget(PluginCall call) {
        try {
            String schoolName = call.getString("schoolName", "학교 미설정");
            String mealKind = call.getString("mealKind", "오늘 중식");
            String mealDate = call.getString("mealDate", "");
            String calories = call.getString("calories", "");
            String menu = call.getString("menu", "");
            String favorites = call.getString("favorites", "");

            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(MealWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            editor.putString("schoolName", schoolName);
            editor.putString("mealKind", mealKind);
            editor.putString("mealDate", mealDate);
            editor.putString("calories", calories);
            editor.putString("menu", menu);
            editor.putString("favorites", favorites);
            editor.putLong("updatedAt", System.currentTimeMillis());
            editor.apply();

            // Refresh all widgets immediately
            MealWidgetProvider.updateAllWidgets(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update widget", e);
        }
    }
}
