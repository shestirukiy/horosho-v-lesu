package com.shestirukiy.horoshovlesu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onResume() {
        super.onResume();
        PartnerWidgetProvider.fetchAndRefreshWidgets(this);
    }
}
