package com.orderfast.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.Application;
import android.content.res.Configuration;
import android.content.Intent;
import android.view.View;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebBackForwardList;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
    private final Runnable immersiveRunnable = this::applyImmersiveMode;
    private static volatile boolean hostActivityWasPaused = false;
    private static volatile boolean hostActivityWasStopped = false;
    private static volatile boolean hostActivityWasDestroyed = false;
    private static volatile boolean immersiveModeActive = false;
    private static volatile boolean immersiveReappliedDuringPayment = false;
    private static volatile boolean orientationChangedDuringPayment = false;
    private static volatile boolean windowFocusChangedDuringPayment = false;
    private static volatile Boolean hostActivityWindowFocus = null;
    private static volatile String hostActivityCurrentOrientation = "unknown";
    private static volatile String hostActivityClassName = "unknown";
    private static volatile int hostActivityIdentityHash = -1;
    private static volatile int hostActivityTaskId = -1;
    private static volatile String hostActivityIntentAction = null;
    private static volatile int hostActivityIntentFlags = 0;
    private static volatile String hostProcessName = "unknown";
    private static volatile long lastHostLifecycleUpdateAtMs = 0L;
    private static volatile int lastKnownOrientationValue = Configuration.ORIENTATION_UNDEFINED;

    public static boolean getHostActivityWasPaused() { return hostActivityWasPaused; }
    public static boolean getHostActivityWasStopped() { return hostActivityWasStopped; }
    public static boolean getHostActivityWasDestroyed() { return hostActivityWasDestroyed; }
    public static boolean getImmersiveModeActive() { return immersiveModeActive; }
    public static boolean getImmersiveReappliedDuringPayment() { return immersiveReappliedDuringPayment; }
    public static boolean getOrientationChangedDuringPayment() { return orientationChangedDuringPayment; }
    public static boolean getWindowFocusChangedDuringPayment() { return windowFocusChangedDuringPayment; }
    public static Boolean getHostActivityWindowFocus() { return hostActivityWindowFocus; }
    public static String getHostActivityCurrentOrientation() { return hostActivityCurrentOrientation; }
    public static String getHostActivityClassName() { return hostActivityClassName; }
    public static int getHostActivityIdentityHash() { return hostActivityIdentityHash; }
    public static int getHostActivityTaskId() { return hostActivityTaskId; }
    public static String getHostActivityIntentAction() { return hostActivityIntentAction; }
    public static int getHostActivityIntentFlags() { return hostActivityIntentFlags; }
    public static String getHostProcessName() { return hostProcessName; }
    public static long getLastHostLifecycleUpdateAtMs() { return lastHostLifecycleUpdateAtMs; }

    public static void resetPaymentHostTelemetry() {
        hostActivityWasPaused = false;
        hostActivityWasStopped = false;
        hostActivityWasDestroyed = false;
        immersiveModeActive = false;
        immersiveReappliedDuringPayment = false;
        orientationChangedDuringPayment = false;
        windowFocusChangedDuringPayment = false;
        hostActivityWindowFocus = null;
        hostActivityIntentAction = null;
        hostActivityIntentFlags = 0;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    private boolean shouldSuppressHostUiChurn() {
        if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive()) {
            return true;
        }
        if (OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
            return true;
        }
        WebView webView = bridge != null ? bridge.getWebView() : null;
        return isPosPaymentEntryRoute(webView);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OrderfastTapToPayPlugin.class);
        super.onCreate(savedInstanceState);
        updateHostIdentity();
        updateHostIntentTelemetry(getIntent());
        hostActivityCurrentOrientation = orientationToName(getResources().getConfiguration().orientation);
        lastKnownOrientationValue = getResources().getConfiguration().orientation;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersiveHandler.postDelayed(immersiveRunnable, 220);
        configureWebViewPresentation();
    }

    @Override
    public void onBackPressed() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (isKioskRoute(webView)) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('orderfast:kiosk-back-blocked'));",
                null
            );
            return;
        }

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        moveTaskToBack(true);
    }

    @Override
    public void onResume() {
        super.onResume();
        updateHostIdentity();
        updateHostIntentTelemetry(getIntent());
        hostActivityCurrentOrientation = orientationToName(getResources().getConfiguration().orientation);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        if (shouldSuppressHostUiChurn()) {
            return;
        }
        immersiveHandler.postDelayed(immersiveRunnable, 120);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        updateHostIdentity();
        updateHostIntentTelemetry(intent);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    @Override
    public void onPause() {
        hostActivityWasPaused = true;
        immersiveModeActive = false;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.removeCallbacks(immersiveRunnable);
        super.onPause();
    }

    @Override
    public void onStop() {
        hostActivityWasStopped = true;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.removeCallbacks(immersiveRunnable);
        super.onStop();
    }

    @Override
    public void onDestroy() {
        hostActivityWasDestroyed = true;
        immersiveModeActive = false;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.removeCallbacks(immersiveRunnable);
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        hostActivityWindowFocus = hasFocus;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive() || OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
            windowFocusChangedDuringPayment = true;
        }
        if (!hasFocus) {
            immersiveModeActive = false;
            immersiveHandler.removeCallbacks(immersiveRunnable);
            return;
        }
        if (!shouldSuppressHostUiChurn()) {
            immersiveHandler.post(immersiveRunnable);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int nextOrientation = newConfig.orientation;
        if (lastKnownOrientationValue != Configuration.ORIENTATION_UNDEFINED && lastKnownOrientationValue != nextOrientation) {
            if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive() || OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
                orientationChangedDuringPayment = true;
            }
        }
        lastKnownOrientationValue = nextOrientation;
        hostActivityCurrentOrientation = orientationToName(nextOrientation);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    private void applyImmersiveMode() {
        if (shouldSuppressHostUiChurn()) {
            return;
        }
        if (getWindow() == null || getWindow().getDecorView() == null) {
            return;
        }
        immersiveModeActive = true;
        if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive() || OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
            immersiveReappliedDuringPayment = true;
        }
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
            return;
        }

        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private String orientationToName(int orientation) {
        if (orientation == Configuration.ORIENTATION_PORTRAIT) return "portrait";
        if (orientation == Configuration.ORIENTATION_LANDSCAPE) return "landscape";
        if (orientation == Configuration.ORIENTATION_SQUARE) return "square";
        if (orientation == Configuration.ORIENTATION_UNDEFINED) return "undefined";
        return "other:" + orientation;
    }

    private void configureWebViewPresentation() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) {
            return;
        }

        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }

    private boolean isKioskRoute(WebView webView) {
        if (webView == null) {
            return false;
        }

        String currentUrl = webView.getUrl();
        if (currentUrl != null && currentUrl.contains("/kiosk/")) {
            return true;
        }

        WebBackForwardList history = webView.copyBackForwardList();
        if (history == null) {
            return false;
        }

        int currentIndex = history.getCurrentIndex();
        if (currentIndex < 0) {
            return false;
        }

        String historyUrl = history.getItemAtIndex(currentIndex).getUrl();
        return historyUrl != null && historyUrl.contains("/kiosk/");
    }

    private boolean isPosPaymentEntryRoute(WebView webView) {
        if (webView == null) {
            return false;
        }

        String currentUrl = webView.getUrl();
        if (currentUrl != null && currentUrl.contains("/payment-entry")) {
            return true;
        }

        WebBackForwardList history = webView.copyBackForwardList();
        if (history == null) {
            return false;
        }

        int currentIndex = history.getCurrentIndex();
        if (currentIndex < 0) {
            return false;
        }

        String historyUrl = history.getItemAtIndex(currentIndex).getUrl();
        return historyUrl != null && historyUrl.contains("/payment-entry");
    }

    private void updateHostIdentity() {
        hostActivityClassName = getClass().getName();
        hostActivityIdentityHash = System.identityHashCode(this);
        hostActivityTaskId = getTaskId();
        hostProcessName = getApplication() != null ? getApplication().getPackageName() : "unknown";
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            hostProcessName = Application.getProcessName();
        } else {
            hostProcessName = getApplication() != null ? getApplication().getPackageName() : "unknown";
        }
    }

    private void updateHostIntentTelemetry(Intent intent) {
        hostActivityIntentAction = intent != null ? intent.getAction() : null;
        hostActivityIntentFlags = intent != null ? intent.getFlags() : 0;
    }
}
