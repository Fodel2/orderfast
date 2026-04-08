package com.orderfast.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebBackForwardList;
import android.content.res.Configuration;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "OrderfastMainActivity";
    private static int activityInstanceCounter = 0;
    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
    private final Runnable immersiveRunnable = this::applyImmersiveMode;
    private int activityInstanceId = 0;

    private void logLifecycle(String event, Bundle savedInstanceState) {
        Log.i(
            TAG,
            "[kiosk][activity_lifecycle] event=" + event
                + " instanceId=" + activityInstanceId
                + " instanceHash=" + System.identityHashCode(this)
                + " hasBridge=" + (bridge != null)
                + " hasSavedState=" + (savedInstanceState != null)
                + " isChangingConfigurations=" + isChangingConfigurations()
                + " tsMs=" + System.currentTimeMillis()
                + " elapsedMs=" + SystemClock.elapsedRealtime()
                + " bridgeHash=" + (bridge == null ? "null" : System.identityHashCode(bridge))
                + " webViewHash=" + ((bridge == null || bridge.getWebView() == null) ? "null" : System.identityHashCode(bridge.getWebView()))
        );
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        activityInstanceId = ++activityInstanceCounter;
        registerPlugin(OrderfastTapToPayPlugin.class);
        super.onCreate(savedInstanceState);
        logLifecycle("onCreate", savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();
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
        logLifecycle("onResume", null);
        immersiveHandler.postDelayed(immersiveRunnable, 120);
    }

    @Override
    public void onStart() {
        super.onStart();
        logLifecycle("onStart", null);
    }

    @Override
    public void onStop() {
        super.onStop();
        logLifecycle("onStop", null);
    }

    @Override
    public void onDestroy() {
        logLifecycle("onDestroy", null);
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.i(
            TAG,
            "[kiosk][activity_lifecycle] event=onConfigurationChanged"
                + " instanceId=" + activityInstanceId
                + " orientation=" + newConfig.orientation
                + " uiMode=" + newConfig.uiMode
                + " tsMs=" + System.currentTimeMillis()
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            immersiveHandler.post(immersiveRunnable);
        }
    }

    private void applyImmersiveMode() {
        if (getWindow() == null || getWindow().getDecorView() == null) {
            return;
        }

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
}
