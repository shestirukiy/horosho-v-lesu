package com.shestirukiy.horoshovlesu;

import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerBridgeInterface();
        checkNotificationPermission();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Check if alert was active right before visit
        boolean wasAlertActive = PartnerWidgetProvider.isAttentionAlertActive(this);

        // Record visit and clear notification
        PartnerWidgetProvider.recordUserVisit(this, null);
        PartnerWidgetProvider.fetchAndRefreshWidgets(this);

        registerBridgeInterface();
        pushStatusToWeb(wasAlertActive);
    }

    @Override
    public void onPause() {
        super.onPause();
        PartnerWidgetProvider.updateAllWidgets(this);
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    private void registerBridgeInterface() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public String getApkVersion() {
                        return getApkVersionString();
                    }

                    @JavascriptInterface
                    public void setTargetPartner(String partnerName) {
                        try {
                            getSharedPreferences("horosho_widget_prefs", MODE_PRIVATE)
                                .edit()
                                .putString("target_partner", partnerName)
                                .apply();
                            PartnerWidgetProvider.fetchAndRefreshWidgets(MainActivity.this);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }

                    @JavascriptInterface
                    public void updateWidgetStats(String jsonStats) {
                        runOnUiThread(() -> {
                            PartnerWidgetProvider.updateStatsDirectly(MainActivity.this, jsonStats);
                        });
                    }

                    @JavascriptInterface
                    public void refreshWidget() {
                        PartnerWidgetProvider.fetchAndRefreshWidgets(MainActivity.this);
                    }

                    @JavascriptInterface
                    public void simulateAbsenceAlert() {
                        runOnUiThread(() -> {
                            PartnerWidgetProvider.simulateAbsence(MainActivity.this);
                            pushStatusToWeb(true);
                        });
                    }

                    @JavascriptInterface
                    public void resetAbsenceAlert() {
                        runOnUiThread(() -> {
                            PartnerWidgetProvider.resetAbsence(MainActivity.this);
                            pushStatusToWeb(false);
                        });
                    }

                    @JavascriptInterface
                    public boolean isAbsenceAlertActive() {
                        return PartnerWidgetProvider.isAttentionAlertActive(MainActivity.this);
                    }

                    @JavascriptInterface
                    public void openExternalUrl(String url) {
                        try {
                            android.content.Intent intent = new android.content.Intent(
                                android.content.Intent.ACTION_VIEW,
                                android.net.Uri.parse(url)
                            );
                            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }, "AndroidNativeBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void pushStatusToWeb(boolean alertActive) {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                final String ver = getApkVersionString();
                getBridge().getWebView().post(() -> {
                    try {
                        getBridge().getWebView().evaluateJavascript(
                            "window.__NATIVE_APK_VERSION__ = '" + ver + "'; " +
                            "window.__PARTNER_ALERT_ACTIVE__ = " + alertActive + "; " +
                            "if (window.__onNativeVersion) { window.__onNativeVersion('" + ver + "'); } " +
                            "if (window.__onPartnerAlertStatus) { window.__onPartnerAlertStatus(" + alertActive + "); }",
                            null
                        );
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String getApkVersionString() {
        try {
            android.content.pm.PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long code = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P 
                    ? pInfo.getLongVersionCode() 
                    : pInfo.versionCode;
            return "v" + pInfo.versionName + " (сборка " + code + ")";
        } catch (Exception e) {
            return "v1.6.0";
        }
    }
}
