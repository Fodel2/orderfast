package com.orderfast.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.Application;
import android.content.res.Configuration;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private static final String IMMERSIVE_LOG_TAG = "OrderfastImmersive";

    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());
    private final Runnable immersiveRunnable = this::reevaluateImmersiveMode;
    private static volatile boolean hostActivityWasPaused = false;
    private static volatile boolean hostActivityWasStopped = false;
    private static volatile boolean hostActivityWasDestroyed = false;
    private static volatile boolean hostActivityWasResumed = false;
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
    private static volatile long hostActivityLastResumedAtMs = 0L;
    private static volatile long hostActivityLastStartedAtMs = 0L;
    private static volatile long hostActivityLastPausedAtMs = 0L;
    private static volatile long hostActivityLastStoppedAtMs = 0L;
    private static volatile long hostActivityLastDestroyedAtMs = 0L;
    private static volatile long hostActivityLastNewIntentAtMs = 0L;
    private static volatile int hostActivityResumeCount = 0;
    private static volatile int hostActivityNewIntentCount = 0;
    private static volatile int lastKnownOrientationValue = Configuration.ORIENTATION_UNDEFINED;
    private static volatile String lastSignaledRoute = null;

    public static boolean getHostActivityWasPaused() { return hostActivityWasPaused; }
    public static boolean getHostActivityWasStopped() { return hostActivityWasStopped; }
    public static boolean getHostActivityWasDestroyed() { return hostActivityWasDestroyed; }
    public static boolean getHostActivityWasResumed() { return hostActivityWasResumed; }
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
    public static long getHostActivityLastResumedAtMs() { return hostActivityLastResumedAtMs; }
    public static long getHostActivityLastStartedAtMs() { return hostActivityLastStartedAtMs; }
    public static long getHostActivityLastPausedAtMs() { return hostActivityLastPausedAtMs; }
    public static long getHostActivityLastStoppedAtMs() { return hostActivityLastStoppedAtMs; }
    public static long getHostActivityLastDestroyedAtMs() { return hostActivityLastDestroyedAtMs; }
    public static long getHostActivityLastNewIntentAtMs() { return hostActivityLastNewIntentAtMs; }
    public static int getHostActivityResumeCount() { return hostActivityResumeCount; }
    public static int getHostActivityNewIntentCount() { return hostActivityNewIntentCount; }

    public static void resetPaymentHostTelemetry() {
        hostActivityWasPaused = false;
        hostActivityWasStopped = false;
        hostActivityWasDestroyed = false;
        hostActivityWasResumed = false;
        immersiveModeActive = false;
        immersiveReappliedDuringPayment = false;
        orientationChangedDuringPayment = false;
        windowFocusChangedDuringPayment = false;
        hostActivityWindowFocus = null;
        hostActivityIntentAction = null;
        hostActivityIntentFlags = 0;
        hostActivityLastResumedAtMs = 0L;
        hostActivityLastStartedAtMs = 0L;
        hostActivityLastPausedAtMs = 0L;
        hostActivityLastStoppedAtMs = 0L;
        hostActivityLastDestroyedAtMs = 0L;
        hostActivityLastNewIntentAtMs = 0L;
        hostActivityResumeCount = 0;
        hostActivityNewIntentCount = 0;
        lastSignaledRoute = null;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    private final class AndroidRouteBridge {
        @JavascriptInterface
        public void setCurrentRoute(String route) {
            String normalized = normalizeRouteSignal(route);
            runOnUiThread(() -> {
                lastSignaledRoute = normalized;
                Log.d(IMMERSIVE_LOG_TAG, "route signal received route=" + normalized);
                reevaluateImmersiveMode();
            });
        }
    }

    private boolean shouldSuppressHostUiChurn() {
        if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive()) {
            return true;
        }
        if (OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
            return true;
        }
        return isPosPaymentEntryRoute(lastSignaledRoute);
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
        lastSignaledRoute = null;
        clearImmersiveMode("cold_launch_default_non_immersive");
        configureWebViewPresentation();
        immersiveHandler.postDelayed(immersiveRunnable, 180);
    }

    @Override
    public void onBackPressed() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (isKioskRoute(lastSignaledRoute)) {
            if (webView != null) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('orderfast:kiosk-back-blocked'));",
                    null
                );
            }
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
        hostActivityWasResumed = true;
        hostActivityLastResumedAtMs = System.currentTimeMillis();
        hostActivityResumeCount += 1;
        updateHostIdentity();
        updateHostIntentTelemetry(getIntent());
        hostActivityCurrentOrientation = orientationToName(getResources().getConfiguration().orientation);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.post(immersiveRunnable);
    }

    @Override
    public void onStart() {
        super.onStart();
        hostActivityLastStartedAtMs = System.currentTimeMillis();
        updateHostIdentity();
        updateHostIntentTelemetry(getIntent());
        hostActivityCurrentOrientation = orientationToName(getResources().getConfiguration().orientation);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hostActivityLastNewIntentAtMs = System.currentTimeMillis();
        hostActivityNewIntentCount += 1;
        updateHostIdentity();
        updateHostIntentTelemetry(intent);
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
    }

    @Override
    public void onPause() {
        hostActivityWasPaused = true;
        hostActivityLastPausedAtMs = System.currentTimeMillis();
        immersiveModeActive = false;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.removeCallbacks(immersiveRunnable);
        super.onPause();
    }

    @Override
    public void onStop() {
        hostActivityWasStopped = true;
        hostActivityLastStoppedAtMs = System.currentTimeMillis();
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        immersiveHandler.removeCallbacks(immersiveRunnable);
        super.onStop();
    }

    @Override
    public void onDestroy() {
        hostActivityWasDestroyed = true;
        hostActivityLastDestroyedAtMs = System.currentTimeMillis();
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
            immersiveHandler.removeCallbacks(immersiveRunnable);
            return;
        }
        immersiveHandler.post(immersiveRunnable);
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

    private void applyImmersiveMode(String reason, String route) {
        if (getWindow() == null || getWindow().getDecorView() == null) {
            return;
        }
        immersiveModeActive = true;
        if (OrderfastTapToPayPlugin.isNativeTapToPayTakeoverActive() || OrderfastTapToPayPlugin.isNativeTapToPayProcessInFlight()) {
            immersiveReappliedDuringPayment = true;
        }
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        Log.d(IMMERSIVE_LOG_TAG, "apply immersive reason=" + reason + " route=" + route);

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

    private void clearImmersiveMode(String reason) {
        if (getWindow() == null || getWindow().getDecorView() == null) {
            return;
        }
        immersiveModeActive = false;
        lastHostLifecycleUpdateAtMs = System.currentTimeMillis();
        Log.d(IMMERSIVE_LOG_TAG, "clear immersive reason=" + reason + " route=" + lastSignaledRoute);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
            }
            return;
        }

        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }

    private void reevaluateImmersiveMode() {
        String activeRoute = resolveActiveRouteFromSignal();
        if (activeRoute == null) {
            clearImmersiveMode("route_unknown_default_clear");
            return;
        }
        if (shouldSuppressHostUiChurn()) {
            clearImmersiveMode("payment_guard_active");
            return;
        }
        if (shouldEnforceImmersiveForRoute(activeRoute)) {
            applyImmersiveMode("route_owner_confirmed", activeRoute);
            return;
        }
        clearImmersiveMode("route_non_owner");
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

        webView.addJavascriptInterface(new AndroidRouteBridge(), "OrderfastAndroidRouteBridge");
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    }

    private boolean isKioskRoute(String route) {
        Uri uri = parseRouteUri(route);
        if (uri == null) {
            return false;
        }
        String path = uri.getPath();
        return path != null && path.startsWith("/kiosk");
    }

    private boolean isPosPaymentEntryRoute(String route) {
        Uri uri = parseRouteUri(route);
        if (uri == null) {
            return false;
        }
        String path = uri.getPath();
        if (path == null) {
            return false;
        }
        return path.startsWith("/payment-entry") || path.contains("/payment-entry");
    }

    private boolean shouldEnforceImmersiveForRoute(String route) {
        Uri uri = parseRouteUri(route);
        if (uri == null) {
            return false;
        }

        String path = uri.getPath();
        if (path == null || path.isEmpty()) {
            return false;
        }

        if (path.startsWith("/payment-entry")) {
            return false;
        }

        if (path.startsWith("/kiosk")) {
            return true;
        }
        if (path.startsWith("/kod")) {
            return true;
        }
        if (path.startsWith("/pos")) {
            return hasPosFullscreenOptIn(uri) && !path.contains("/payment-entry");
        }
        return false;
    }

    private boolean hasPosFullscreenOptIn(Uri uri) {
        String query = uri.getQueryParameter("fullscreen");
        if (query == null) return false;
        String normalized = query.trim().toLowerCase();
        return normalized.equals("1")
            || normalized.equals("true")
            || normalized.equals("yes")
            || normalized.equals("on");
    }

    private String resolveActiveRouteFromSignal() {
        String normalized = normalizeRouteSignal(lastSignaledRoute);
        if (normalized == null) {
            Log.d(IMMERSIVE_LOG_TAG, "route unresolved (no signal)");
            return null;
        }
        Log.d(IMMERSIVE_LOG_TAG, "route resolved route=" + normalized);
        return normalized;
    }

    private String normalizeRouteSignal(String route) {
        if (route == null) {
            return null;
        }
        String trimmed = route.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed;
    }

    private Uri parseRouteUri(String route) {
        String normalized = normalizeRouteSignal(route);
        if (normalized == null) {
            return null;
        }

        try {
            if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
                return Uri.parse(normalized);
            }
            if (normalized.startsWith("/")) {
                return Uri.parse("https://orderfast.local" + normalized);
            }
            return Uri.parse("https://orderfast.local/" + normalized);
        } catch (Exception ignored) {
            Log.d(IMMERSIVE_LOG_TAG, "route parse failed route=" + normalized);
            return null;
        }
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
