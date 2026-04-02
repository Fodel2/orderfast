package com.orderfast.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebBackForwardList;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
    private final Runnable immersiveRunnable = this::applyImmersiveMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OrderfastTapToPayPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();
        configureWebViewPresentation();
        Toast.makeText(this, "Build " + BuildConfig.VERSION_NAME, Toast.LENGTH_LONG).show();
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
        immersiveHandler.postDelayed(immersiveRunnable, 120);
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
