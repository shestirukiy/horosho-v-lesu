package com.shestirukiy.horoshovlesu;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PartnerWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SWITCH_PARTNER = "com.shestirukiy.horoshovlesu.ACTION_SWITCH_PARTNER";
    public static final String ACTION_REFRESH = "com.shestirukiy.horoshovlesu.ACTION_REFRESH";
    private static final String SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSGd0RJp8SOB2B3Bc4UL7MbqjAty7BrIdNxFjSigYbdSflnW6YziJDs3J7b6J27Sbb/exec";
    private static final String PREFS_NAME = "horosho_widget_prefs";

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidgetUI(context, appWidgetManager, appWidgetId);
        }
        // Fetch fresh data in background
        fetchAndRefreshWidgets(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();

        if (ACTION_SWITCH_PARTNER.equals(action)) {
            // Toggle partner
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = getTargetPartner(context);
            String next = "Ирина".equals(current) ? "Артем" : "Ирина";
            prefs.edit().putString("target_partner", next).apply();

            // Refresh UI and fetch
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, PartnerWidgetProvider.class));
            for (int id : appWidgetIds) {
                updateWidgetUI(context, appWidgetManager, id);
            }
            fetchAndRefreshWidgets(context);
        } else if (ACTION_REFRESH.equals(action)) {
            fetchAndRefreshWidgets(context);
        }
    }

    private static String getTargetPartner(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String defaultPartner = "Ирина";
        try {
            defaultPartner = context.getString(R.string.widget_target_partner);
        } catch (Exception ignored) {}
        return prefs.getString("target_partner", defaultPartner);
    }

    private static void updateWidgetUI(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_partner_status);
        String partner = getTargetPartner(context);

        // Cached stats
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int sexVal = prefs.getInt("stat_sex_" + partner, 5);
        int commVal = prefs.getInt("stat_comm_" + partner, 8);
        int domVal = prefs.getInt("stat_dom_" + partner, 7);
        String sexDir = prefs.getString("stat_dir_sex_" + partner, "(=)");
        String commDir = prefs.getString("stat_dir_comm_" + partner, "(=)");
        String domDir = prefs.getString("stat_dir_dom_" + partner, "(=)");

        // Set Partner Info & Large Background Portrait
        views.setTextViewText(R.id.widget_partner_name, partner.toUpperCase());

        if ("Артем".equals(partner)) {
            views.setImageViewResource(R.id.widget_bg_photo, R.drawable.avatar_artem_card);
        } else {
            views.setImageViewResource(R.id.widget_bg_photo, R.drawable.avatar_irina_card);
        }

        // Draw RPG Progress Bars as 100% stable in-memory Bitmaps
        views.setImageViewBitmap(R.id.widget_pb_sex, createProgressBarBitmap(sexVal, Color.parseColor("#FF4D6D")));
        views.setTextViewText(R.id.widget_val_sex, String.valueOf(sexVal));

        views.setImageViewBitmap(R.id.widget_pb_comm, createProgressBarBitmap(commVal, Color.parseColor("#00D2D3")));
        views.setTextViewText(R.id.widget_val_comm, String.valueOf(commVal));

        views.setImageViewBitmap(R.id.widget_pb_dom, createProgressBarBitmap(domVal, Color.parseColor("#2ECC71")));
        views.setTextViewText(R.id.widget_val_dom, String.valueOf(domVal));

        // Set Direction Icons
        views.setImageViewResource(R.id.widget_dir_sex, getDirDrawable(sexDir));
        views.setImageViewResource(R.id.widget_dir_comm, getDirDrawable(commDir));
        views.setImageViewResource(R.id.widget_dir_dom, getDirDrawable(domDir));

        // Click on widget root opens MainActivity (the app!)
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                context, 0, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, openAppPending);

        // Click on switch button toggles between spouses
        Intent switchIntent = new Intent(context, PartnerWidgetProvider.class);
        switchIntent.setAction(ACTION_SWITCH_PARTNER);
        PendingIntent switchPending = PendingIntent.getBroadcast(
                context, 1, switchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_switch, switchPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap createProgressBarBitmap(int value, int fillColor) {
        int width = 200;
        int height = 14;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(Color.parseColor("#4DFFFFFF"));
        float radius = height / 2f;
        canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, bgPaint);

        float progressFraction = Math.max(0f, Math.min(1f, value / 10f));
        float fillWidth = width * progressFraction;
        if (fillWidth > 0) {
            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            fillPaint.setColor(fillColor);
            canvas.drawRoundRect(new RectF(0, 0, fillWidth, height), radius, radius, fillPaint);
        }

        return bitmap;
    }

    public static void fetchAndRefreshWidgets(Context context) {
        executor.execute(() -> {
            try {
                String jsonStr = fetchUrlWithRedirects(SCRIPT_URL);
                if (jsonStr == null || jsonStr.isEmpty()) return;

                JSONObject json = new JSONObject(jsonStr);
                SharedPreferences.Editor editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();

                String[] partners = new String[]{"Ирина", "Артем"};
                for (String p : partners) {
                    if (json.has("Секс")) {
                        editor.putInt("stat_sex_" + p, json.getJSONObject("Секс").optInt(p, 5));
                    }
                    if (json.has("Общение")) {
                        editor.putInt("stat_comm_" + p, json.getJSONObject("Общение").optInt(p, 8));
                    }
                    if (json.has("Быт")) {
                        editor.putInt("stat_dom_" + p, json.getJSONObject("Быт").optInt(p, 7));
                    }
                    if (json.has("Секс динамика")) {
                        editor.putString("stat_dir_sex_" + p, json.getJSONObject("Секс динамика").optString(p, "(=)"));
                    }
                    if (json.has("Общение динамика")) {
                        editor.putString("stat_dir_comm_" + p, json.getJSONObject("Общение динамика").optString(p, "(=)"));
                    }
                    if (json.has("Быт динамика")) {
                        editor.putString("stat_dir_dom_" + p, json.getJSONObject("Быт динамика").optString(p, "(=)"));
                    }
                }
                editor.apply();

                // Update all widget instances
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
                ComponentName widgetComponent = new ComponentName(context, PartnerWidgetProvider.class);
                int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent);
                for (int id : appWidgetIds) {
                    updateWidgetUI(context, appWidgetManager, id);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private static int getDirDrawable(String dir) {
        if (dir != null) {
            if (dir.contains("+")) return R.drawable.dir_plus;
            if (dir.contains("-")) return R.drawable.dir_minus;
        }
        return R.drawable.dir_equal;
    }

    private static String fetchUrlWithRedirects(String urlString) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        int status = conn.getResponseCode();

        if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307) {
            String newUrl = conn.getHeaderField("Location");
            return fetchUrlWithRedirects(newUrl);
        }

        if (status != HttpURLConnection.HTTP_OK) {
            return null;
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
        reader.close();
        return sb.toString();
    }
}
