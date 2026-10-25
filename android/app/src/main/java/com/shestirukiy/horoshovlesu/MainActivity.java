package com.shestirukiy.horoshovlesu;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerBridgeInterface();
    }

    @Override
    public void onResume() {
        super.onResume();
        PartnerWidgetProvider.fetchAndRefreshWidgets(this);
        registerBridgeInterface();
        pushVersionToWeb();
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

    private void pushVersionToWeb() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                final String ver = getApkVersionString();
                getBridge().getWebView().post(() -> {
                    try {
                        getBridge().getWebView().evaluateJavascript(
                            "window.__NATIVE_APK_VERSION__ = '" + ver + "'; if (window.__onNativeVersion) { window.__onNativeVersion('" + ver + "'); }",
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
            return "v1.3";
        }
    }
}

