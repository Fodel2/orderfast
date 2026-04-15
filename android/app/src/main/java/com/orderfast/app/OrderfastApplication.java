package com.orderfast.app;

import android.app.Application;
import android.os.Build;
import android.util.Log;

import com.stripe.stripeterminal.TerminalApplicationDelegate;
import com.stripe.stripeterminal.taptopay.TapToPay;

public class OrderfastApplication extends Application {
    private static final String TAG = "OrderfastApplication";

    @Override
    public void onCreate() {
        super.onCreate();

        final String processName = resolveProcessName();
        final boolean isTapToPayProcess = TapToPay.isInTapToPayProcess();
        Log.i(TAG, "onCreate processName=" + processName + " isTapToPayProcess=" + isTapToPayProcess);

        if (isTapToPayProcess) {
            // Stripe Tap to Pay process: skip non-essential global app initialization.
            TerminalApplicationDelegate.onCreate(this);
            Log.i(TAG, "TapToPay process detected; skipped Orderfast main-process initializers.");
            return;
        }

        TerminalApplicationDelegate.onCreate(this);
        Log.i(TAG, "Main app process detected; full Orderfast initialization path allowed.");
    }

    private String resolveProcessName() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return Application.getProcessName();
        }
        return getApplicationInfo() == null ? "unknown" : getApplicationInfo().processName;
    }
}
