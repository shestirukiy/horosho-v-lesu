package com.shestirukiy.horoshovlesu;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

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
    public static final String ACTION_SIMULATE_ABSENCE = "com.shestirukiy.horoshovlesu.ACTION_SIMULATE_ABSENCE";
    public static final String ACTION_RESET_ABSENCE = "com.shestirukiy.horoshovlesu.ACTION_RESET_ABSENCE";

    public static final String SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSGd0RJp8SOB2B3Bc4UL7MbqjAty7BrIdNxFjSigYbdSflnW6YziJDs3J7b6J27Sbb/exec";
    public static final String PREFS_NAME = "horosho_widget_prefs";
    public static final int NOTIFICATION_ID = 48123;
    public static final String CHANNEL_ID = "partner_attention_channel";
    public static final String ATTENTION_MESSAGE = "Никто на меня не обращает внимания...";

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
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        if (ACTION_SWITCH_PARTNER.equals(action)) {
            // Toggle partner
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String current = getTargetPartner(context);
            String next = "Ирина".equals(current) ? "Артем" : "Ирина";
            prefs.edit().putString("target_partner", next).apply();

            updateAllWidgets(context);
            fetchAndRefreshWidgets(context);
        } else if (ACTION_REFRESH.equals(action)) {
            updateAllWidgets(context);
            fetchAndRefreshWidgets(context);
        } else if (ACTION_SIMULATE_ABSENCE.equals(action)) {
            simulateAbsence(context);
        } else if (ACTION_RESET_ABSENCE.equals(action)) {
            resetAbsence(context);
        }
    }

    public static String getTargetPartner(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String defaultPartner = "Ирина";
        try {
            defaultPartner = context.getString(R.string.widget_target_partner);
        } catch (Exception ignored) {}
        return prefs.getString("target_partner", defaultPartner);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName widgetComponent = new ComponentName(context, PartnerWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent);
        for (int id : appWidgetIds) {
            updateWidgetUI(context, appWidgetManager, id);
        }
    }

    public static boolean isAttentionAlertActive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (prefs.getBoolean("debug_force_attention_alert", false)) {
            return true;
        }

        long lastOpen = prefs.getLong("last_app_open_time", 0);
        if (lastOpen == 0) {
            return false;
        }

        long now = System.currentTimeMillis();
        long twoDaysMs = 2L * 24 * 60 * 60 * 1000L; // 48 hours
        boolean isInactive2Days = (now - lastOpen) >= twoDaysMs;

        String partner = getTargetPartner(context);
        boolean partnerChanged = prefs.getBoolean("partner_has_changed_since_last_visit_" + partner, false);

        return isInactive2Days && partnerChanged;
    }

    public static void simulateAbsence(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String partner = getTargetPartner(context);
        long threeDaysAgo = System.currentTimeMillis() - (3L * 24 * 60 * 60 * 1000L);
        prefs.edit()
            .putLong("last_app_open_time", threeDaysAgo)
            .putBoolean("partner_has_changed_since_last_visit_" + partner, true)
            .putBoolean("debug_force_attention_alert", true)
            .putBoolean("debug_force_notification", true)
            .putLong("last_attention_notification_time", 0)
            .apply();

        updateAllWidgets(context);
        checkAndSendAttentionNotification(context);
    }

    public static void resetAbsence(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String partner = getTargetPartner(context);
        prefs.edit()
            .putLong("last_app_open_time", System.currentTimeMillis())
            .putBoolean("partner_has_changed_since_last_visit_" + partner, false)
            .putBoolean("debug_force_attention_alert", false)
            .apply();

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }

        updateAllWidgets(context);
    }

    public static void checkAndSendAttentionNotification(Context context) {
        if (!isAttentionAlertActive(context)) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID);
            }
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastNotificationTime = prefs.getLong("last_attention_notification_time", 0);
        long twelveHoursMs = 12L * 60 * 60 * 1000L;

        boolean force = prefs.getBoolean("debug_force_notification", false);
        if (!force && (now - lastNotificationTime < twelveHoursMs)) {
            return;
        }

        prefs.edit()
            .putLong("last_attention_notification_time", now)
            .putBoolean("debug_force_notification", false)
            .apply();

        sendNotification(context);
    }

    public static void sendNotification(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Хорошо в Лесу: Внимание",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Уведомления о статусе и внимании партнера");
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
            }

            String partner = getTargetPartner(context);
            String title = partner;

            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Bitmap largeAvatar = null;
            try {
                int avatarRes = "Артем".equals(partner) ? R.drawable.avatar_artem_card : R.drawable.avatar_irina_card;
                largeAvatar = BitmapFactory.decodeResource(context.getResources(), avatarRes);
            } catch (Exception ignored) {}

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.widget_heart)
                .setContentTitle(title)
                .setContentText(ATTENTION_MESSAGE)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(ATTENTION_MESSAGE))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            if (largeAvatar != null) {
                builder.setLargeIcon(largeAvatar);
            }

            nm.notify(NOTIFICATION_ID, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void recordUserVisit(Context context, String partnerName) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        long now = System.currentTimeMillis();
        editor.putLong("last_app_open_time", now);
        editor.putBoolean("debug_force_attention_alert", false);

        String partner = partnerName != null && !partnerName.isEmpty() ? partnerName : getTargetPartner(context);
        editor.putBoolean("partner_has_changed_since_last_visit_" + partner, false);

        // Snapshot current partner stats as baseline
        String currentSig = buildCurrentSignature(prefs, partner);
        editor.putString("partner_snapshot_at_last_visit_" + partner, currentSig);
        editor.apply();

        // Dismiss notification and hide comic bubble
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }

        updateAllWidgets(context);
    }

    private static String buildCurrentSignature(SharedPreferences prefs, String partner) {
        int sex = prefs.getInt("stat_sex_" + partner, 5);
        int comm = prefs.getInt("stat_comm_" + partner, 8);
        int dom = prefs.getInt("stat_dom_" + partner, 7);
        String sexDir = prefs.getString("stat_dir_sex_" + partner, "(=)");
        String commDir = prefs.getString("stat_dir_comm_" + partner, "(=)");
        String domDir = prefs.getString("stat_dir_dom_" + partner, "(=)");
        String sexWish = prefs.getString("stat_wish_sex_" + partner, "");
        String commWish = prefs.getString("stat_wish_comm_" + partner, "");
        String domWish = prefs.getString("stat_wish_dom_" + partner, "");
        return partner + "#" + sex + "#" + comm + "#" + dom + "#" + sexDir + "#" + commDir + "#" + domDir + "#" + sexWish + "#" + commWish + "#" + domWish;
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

        // Comic Speech Bubble
        boolean showBubble = isAttentionAlertActive(context);
        views.setViewVisibility(R.id.widget_comic_bubble_container, showBubble ? View.VISIBLE : View.GONE);
        if (showBubble) {
            views.setTextViewText(R.id.widget_comic_bubble_text, ATTENTION_MESSAGE);
        }

        // Click on partner name toggles spouse (Artem <-> Irina)
        Intent switchIntent = new Intent(context, PartnerWidgetProvider.class);
        switchIntent.setAction(ACTION_SWITCH_PARTNER);
        PendingIntent switchPending = PendingIntent.getBroadcast(
                context, 1, switchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_partner_name, switchPending);

        // Click on widget root opens MainActivity (the app!)
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                context, 0, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, openAppPending);

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

    public static void saveStatsJsonToPrefs(Context context, JSONObject json) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            String[] partners = new String[]{"Ирина", "Артем"};
            for (String p : partners) {
                int sex = prefs.getInt("stat_sex_" + p, 5);
                int comm = prefs.getInt("stat_comm_" + p, 8);
                int dom = prefs.getInt("stat_dom_" + p, 7);
                String sexDir = prefs.getString("stat_dir_sex_" + p, "(=)");
                String commDir = prefs.getString("stat_dir_comm_" + p, "(=)");
                String domDir = prefs.getString("stat_dir_dom_" + p, "(=)");
                String sexWish = prefs.getString("stat_wish_sex_" + p, "");
                String commWish = prefs.getString("stat_wish_comm_" + p, "");
                String domWish = prefs.getString("stat_wish_dom_" + p, "");

                if (json.has("Секс")) {
                    sex = json.getJSONObject("Секс").optInt(p, sex);
                    editor.putInt("stat_sex_" + p, sex);
                }
                if (json.has("Общение")) {
                    comm = json.getJSONObject("Общение").optInt(p, comm);
                    editor.putInt("stat_comm_" + p, comm);
                }
                if (json.has("Быт")) {
                    dom = json.getJSONObject("Быт").optInt(p, dom);
                    editor.putInt("stat_dom_" + p, dom);
                }
                if (json.has("Секс динамика")) {
                    sexDir = json.getJSONObject("Секс динамика").optString(p, sexDir);
                    editor.putString("stat_dir_sex_" + p, sexDir);
                }
                if (json.has("Общение динамика")) {
                    commDir = json.getJSONObject("Общение динамика").optString(p, commDir);
                    editor.putString("stat_dir_comm_" + p, commDir);
                }
                if (json.has("Быт динамика")) {
                    domDir = json.getJSONObject("Быт динамика").optString(p, domDir);
                    editor.putString("stat_dir_dom_" + p, domDir);
                }
                if (json.has("Секс пожелания")) {
                    sexWish = json.getJSONObject("Секс пожелания").optString(p, sexWish);
                    editor.putString("stat_wish_sex_" + p, sexWish);
                }
                if (json.has("Общение пожелания")) {
                    commWish = json.getJSONObject("Общение пожелания").optString(p, commWish);
                    editor.putString("stat_wish_comm_" + p, commWish);
                }
                if (json.has("Быт пожелания")) {
                    domWish = json.getJSONObject("Быт пожелания").optString(p, domWish);
                    editor.putString("stat_wish_dom_" + p, domWish);
                }

                // Signature check for changes made by partner
                String currentSig = p + "#" + sex + "#" + comm + "#" + dom + "#" + sexDir + "#" + commDir + "#" + domDir + "#" + sexWish + "#" + commWish + "#" + domWish;
                String savedSig = prefs.getString("partner_snapshot_at_last_visit_" + p, null);

                if (savedSig == null) {
                    editor.putString("partner_snapshot_at_last_visit_" + p, currentSig);
                } else if (!savedSig.equals(currentSig)) {
                    editor.putBoolean("partner_has_changed_since_last_visit_" + p, true);
                }
            }
            editor.apply();

            // Update all widget instances immediately
            updateAllWidgets(context);

            // Check and trigger notifications if condition met
            checkAndSendAttentionNotification(context);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void updateStatsDirectly(Context context, String jsonStr) {
        if (jsonStr == null || jsonStr.isEmpty()) return;
        try {
            JSONObject json = new JSONObject(jsonStr);
            saveStatsJsonToPrefs(context, json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void fetchAndRefreshWidgets(Context context) {
        executor.execute(() -> {
            try {
                String jsonStr = fetchUrlWithRedirects(SCRIPT_URL);
                if (jsonStr == null || jsonStr.isEmpty()) return;

                JSONObject json = new JSONObject(jsonStr);
                saveStatsJsonToPrefs(context, json);
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

        if (status >= 300 && status < 400) {
            String newUrl = conn.getHeaderField("Location");
            if (newUrl != null && !newUrl.isEmpty()) {
                return fetchUrlWithRedirects(newUrl);
            }
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
