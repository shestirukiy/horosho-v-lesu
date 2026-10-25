package com.shestirukiy.horoshovlesu;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        PartnerWidgetProvider.fetchAndRefreshWidgets(this);
    }
}
