package com.orderfast.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.app.ActivityManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.stripe.stripeterminal.Terminal;
import com.stripe.stripeterminal.external.callable.Callback;
import com.stripe.stripeterminal.external.callable.Cancelable;
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider;
import com.stripe.stripeterminal.external.callable.DiscoveryListener;
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback;
import com.stripe.stripeterminal.external.callable.ReaderCallback;
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener;
import com.stripe.stripeterminal.external.callable.TerminalListener;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.CollectPaymentIntentConfiguration;
import com.stripe.stripeterminal.external.models.ConfirmPaymentIntentConfiguration;
import com.stripe.stripeterminal.external.models.DisconnectReason;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentIntentStatus;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.TerminalErrorCode;
import com.stripe.stripeterminal.external.models.TerminalException;
import com.stripe.stripeterminal.log.LogLevel;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "OrderfastTapToPay",
    permissions = {
        @Permission(
            alias = "location",
            strings = {Manifest.permission.ACCESS_FINE_LOCATION}
        )
    }
)
public class OrderfastTapToPayPlugin extends Plugin {
    private static final String TAG = "OrderfastTapToPay";
    private static final long OPERATION_TIMEOUT_MS = 120_000L;
    private static final long BACKGROUND_INTERRUPTION_MIN_MS = 4_000L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private volatile String status = "idle";
    private volatile boolean inFlight = false;
    private volatile String currentSessionId = null;
    private volatile String currentRestaurantId = null;
    private volatile String currentBackendBaseUrl = null;
    private volatile String currentTerminalLocationId = null;
    private volatile String currentFlowRunId = null;
    private volatile Reader connectedReader = null;
    private volatile PaymentIntent activePaymentIntent = null;
    private volatile Cancelable discoverCancelable = null;
    private volatile Cancelable processCancelable = null;
    private volatile Runnable timeoutRunnable = null;
    private volatile List<Reader> lastDiscoveredReaders = null;
    private volatile PluginCall pendingSetupPermissionCall = null;
    private volatile boolean cancelRequestedByApp = false;
    private volatile boolean lifecyclePausedDuringActiveFlow = false;
    private volatile boolean confirmedBackgroundInterruption = false;
    private volatile boolean backgroundInterruptionCandidate = false;
    private volatile boolean stripeTakeoverObserved = false;
    private volatile long backgroundInterruptionCandidateAtMs = 0L;
    private volatile long lastPauseAtMs = 0L;
    private volatile long lastStopAtMs = 0L;
    private volatile long lastResumeAtMs = 0L;
    private volatile JSObject cachedFinalResult = null;
    private volatile long cachedFinalResultAtMs = 0L;
    private static int pluginInstanceCounter = 0;
    private int pluginInstanceId = 0;
    private volatile long activeRunMonotonicStartNs = 0L;
    private volatile int activeRunSequence = 0;
    private volatile long lastReaderDisconnectElapsedMs = 0L;
    private volatile String lastReaderDisconnectReason = "none";

    @Override
    public void load() {
        super.load();
        pluginInstanceId = ++pluginInstanceCounter;
        traceTimeline("plugin_load", null);
    }

    private void logFlowEvent(String stage, JSObject payload) {
        payload.put("timestampMs", System.currentTimeMillis());
        logStartupStage(stage, payload);
    }

    private void logCancelSource(String source) {
        JSObject payload = lifecyclePayload("cancel_invoked");
        payload.put("source", source);
        payload.put("path", source);
        logFlowEvent("native_cancel_invoked", payload);
    }

    private boolean isCollectOrProcessActive() {
        return inFlight && ("collecting".equals(status) || "processing".equals(status));
    }

    private JSObject paymentRunGuardPayload(String path, String reason) {
        JSObject payload = lifecyclePayload("payment_run_guard");
        payload.put("path", path);
        payload.put("reason", reason);
        payload.put("flowRunId", currentFlowRunId);
        payload.put("paymentPhase", status);
        payload.put("collectOrProcessActive", isCollectOrProcessActive());
        payload.put("nativeInFlight", inFlight);
        payload.put("takeoverActive", stripeTakeoverObserved);
        payload.put("appBackgrounded", isAppInBackground());
        return payload;
    }

    private void logCancelOrCleanupPath(String event, String path, String reason) {
        logFlowEvent(event, paymentRunGuardPayload(path, reason));
    }

    private void cacheFinalResult(JSObject payload, String source) {
        if (payload == null) return;
        cachedFinalResult = payload;
        cachedFinalResultAtMs = System.currentTimeMillis();
        JSObject logPayload = lifecyclePayload("native_final_result_cached");
        logPayload.put("source", source);
        logPayload.put("resultStatus", payload.getString("status"));
        logPayload.put("resultCode", payload.getString("code"));
        logPayload.put("cachedAtMs", cachedFinalResultAtMs);
        logFlowEvent("native_final_result_cached", logPayload);
        JSObject timelinePayload = new JSObject();
        timelinePayload.put("source", source);
        timelinePayload.put("resultStatus", payload.getString("status"));
        timelinePayload.put("resultCode", payload.getString("code"));
        traceTimeline("final_cache_write", timelinePayload);
    }

    private void clearCachedFinalResult(String reason) {
        cachedFinalResult = null;
        cachedFinalResultAtMs = 0L;
        JSObject payload = lifecyclePayload("native_final_result_cache_cleared");
        payload.put("reason", reason);
        logFlowEvent("native_final_result_cache_cleared", payload);
    }

    private void clearActivePaymentState() {
        clearOperationTimeout();
        activePaymentIntent = null;
        processCancelable = null;
        cancelRequestedByApp = false;
        lifecyclePausedDuringActiveFlow = false;
        confirmedBackgroundInterruption = false;
        backgroundInterruptionCandidate = false;
        stripeTakeoverObserved = false;
        backgroundInterruptionCandidateAtMs = 0L;
        lastPauseAtMs = 0L;
        lastStopAtMs = 0L;
        lastResumeAtMs = 0L;
        inFlight = false;
        activeRunMonotonicStartNs = 0L;
    }

    private void resetStatusForNextAttempt() {
        if (connectedReader != null && Terminal.isInitialized() && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED) {
            status = "ready";
        } else {
            status = "idle";
        }
    }

    private boolean isDebugBuild() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private final ConnectionTokenProvider connectionTokenProvider = new ConnectionTokenProvider() {
        @Override
        public void fetchConnectionToken(ConnectionTokenCallback callback) {
            if (currentSessionId == null || currentRestaurantId == null || currentBackendBaseUrl == null) {
                callback.onFailure(new com.stripe.stripeterminal.external.models.ConnectionTokenException("Missing tap-to-pay session context"));
                return;
            }

            executor.execute(() -> {
                try {
                    JSONObject response = postJson(
                        currentBackendBaseUrl + "/api/kiosk/payments/card-present/connection-token",
                        "{\"session_id\":\"" + escapeJson(currentSessionId) + "\",\"restaurant_id\":\"" + escapeJson(currentRestaurantId) + "\"}"
                    );
                    String secret = response.optString("secret", "");
                    if (secret.isEmpty()) {
                        callback.onFailure(new com.stripe.stripeterminal.external.models.ConnectionTokenException("Connection token response missing secret"));
                        return;
                    }
                    callback.onSuccess(secret);
                } catch (Exception e) {
                    callback.onFailure(new com.stripe.stripeterminal.external.models.ConnectionTokenException("Failed to fetch connection token", e));
                }
            });
        }
    };

    private final TerminalListener terminalListener = new TerminalListener() {
        @Override
        public void onConnectionStatusChange(ConnectionStatus connectionStatus) {
            if (isDebugBuild()) {
                Log.d(TAG, "Connection status: " + connectionStatus);
            }
            if (connectionStatus == ConnectionStatus.CONNECTED) {
                status = "ready";
            } else if (connectionStatus == ConnectionStatus.NOT_CONNECTED && !"failed".equals(status) && !"canceled".equals(status)) {
                status = "idle";
            }
        }

        @Override
        public void onPaymentStatusChange(PaymentStatus paymentStatus) {
            if (isDebugBuild()) {
                Log.d(TAG, "Payment status: " + paymentStatus);
            }
            if (paymentStatus == PaymentStatus.WAITING_FOR_INPUT) {
                status = "collecting";
            } else if (paymentStatus == PaymentStatus.PROCESSING) {
                status = "processing";
            } else if (paymentStatus == PaymentStatus.READY && "processing".equals(status)) {
                status = "ready";
            }
        }
    };

    private final TapToPayReaderListener tapToPayReaderListener = new TapToPayReaderListener() {
        @Override
        public void onDisconnect(DisconnectReason reason) {
            lastReaderDisconnectElapsedMs = SystemClock.elapsedRealtime();
            lastReaderDisconnectReason = reason == null ? "UNKNOWN" : reason.name();
            JSObject disconnectPayload = lifecyclePayload("reader_disconnect");
            disconnectPayload.put("disconnectReason", reason == null ? "UNKNOWN" : reason.name());
            disconnectPayload.put("path", "tap_to_pay_reader_listener.onDisconnect");
            disconnectPayload.put("flowRunId", currentFlowRunId);
            disconnectPayload.put("paymentPhase", status);
            disconnectPayload.put("collectOrProcessActive", isCollectOrProcessActive());
            disconnectPayload.put("nativeInFlight", inFlight);
            disconnectPayload.put("takeoverActive", stripeTakeoverObserved);
            disconnectPayload.put("appBackgrounded", isAppInBackground());
            logFlowEvent("native_disconnect_invoked", disconnectPayload);
            JSObject timelinePayload = new JSObject();
            timelinePayload.put("disconnectReason", lastReaderDisconnectReason);
            traceTimeline("reader_disconnect_callback", timelinePayload);
            connectedReader = null;
            if (!"canceled".equals(status)) {
                status = "failed";
            }
        }
    };

    @PluginMethod
    public void isTapToPaySupported(PluginCall call) {
        logStartupStage("native_support_check_entered", new JSObject());
        JSObject result = new JSObject();
        boolean hasNfc = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC);

        if (!hasNfc) {
            result.put("supported", false);
            result.put("reason", "NFC is not available on this device.");
        } else {
            result.put("supported", true);
            result.put("reason", "Tap to Pay hardware prerequisites satisfied.");
        }
        result.put("permissionState", permissionStateToString(getPermissionState("location")));
        result.put("hasNfc", hasNfc);
        result.put("locationServicesEnabled", isLocationServicesEnabled());
        result.put("nativeStage", "native_support_check_result");
        logStartupStage("native_support_check_result", result);
        call.resolve(result);
    }

    @PluginMethod
    public void getLocationPermissionState(PluginCall call) {
        JSObject payload = new JSObject();
        payload.put("permissionState", permissionStateToString(getPermissionState("location")));
        payload.put("nativeStage", "native_permission_state_result");
        logStartupStage("native_permission_state_result", payload);
        call.resolve(payload);
    }

    @PluginMethod
    public void requestLocationPermission(PluginCall call) {
        pendingSetupPermissionCall = call;
        logStartupStage("native_permission_request_started", detail("native_permission_request_started", "requesting", null));
        requestPermissionForAlias("location", call, "setupPermissionCallback");
    }

    @PluginMethod
    public void getLocationServicesStatus(PluginCall call) {
        JSObject payload = new JSObject();
        payload.put("enabled", isLocationServicesEnabled());
        payload.put("nativeStage", "native_location_services_result");
        logStartupStage("native_location_services_result", payload);
        call.resolve(payload);
    }

    @PluginMethod
    public void checkTapToPayReadiness(PluginCall call) {
        JSObject payload = buildReadinessPayload();
        payload.put("nativeStage", "native_readiness_result");
        logStartupStage("native_readiness_result", payload);
        call.resolve(payload);
    }

    @PluginMethod
    public void ensureTapToPaySetup(PluginCall call) {
        boolean promptIfNeeded = call.getBoolean("promptIfNeeded", false);
        boolean hasLocationPermission = getPermissionState("location") == PermissionState.GRANTED;
        if (!hasLocationPermission && promptIfNeeded) {
            pendingSetupPermissionCall = call;
            requestPermissionForAlias("location", call, "setupPermissionCallback");
            return;
        }
        JSObject payload = buildReadinessPayload();
        payload.put("nativeStage", "native_setup_result");
        call.resolve(payload);
    }

    @PermissionCallback
    public void setupPermissionCallback(PluginCall ignoredCall) {
        PluginCall call = pendingSetupPermissionCall;
        pendingSetupPermissionCall = null;
        if (call == null) {
            return;
        }

        JSObject payload = buildReadinessPayload();
        payload.put("permissionState", permissionStateToString(getPermissionState("location")));
        payload.put("granted", getPermissionState("location") == PermissionState.GRANTED);
        payload.put("nativeStage", "native_permission_request_result");
        logStartupStage("native_permission_request_result", payload);
        call.resolve(payload);
    }

    private JSObject buildReadinessPayload() {
        boolean hasNfc = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC);
        PermissionState permissionState = getPermissionState("location");
        boolean hasLocationPermission = permissionState == PermissionState.GRANTED;
        boolean locationServicesEnabled = isLocationServicesEnabled();

        JSObject payload = new JSObject();
        payload.put("ready", hasNfc && hasLocationPermission && locationServicesEnabled);
        payload.put("supported", hasNfc);
        payload.put("reason", !hasNfc
            ? "NFC is not available on this device."
            : (!hasLocationPermission
                ? "Location permission is required for Tap to Pay."
                : (locationServicesEnabled
                    ? "Tap to Pay device prerequisites satisfied."
                    : "Location services must be enabled for Tap to Pay.")));
        payload.put("permissionState", permissionStateToString(permissionState));
        payload.put("locationServicesEnabled", locationServicesEnabled);
        return payload;
    }

    @PluginMethod
    public void prepareTapToPay(PluginCall call) {
        logStartupStage("native_prepare_entered", new JSObject());
        if (inFlight) {
            JSObject payload = result("failed", "native_busy", "Another Tap to Pay request is active.");
            payload.put("detail", detail("native_prepare_entered", "in_flight", null));
            logStartupStage("native_prepare_result", payload);
            call.resolve(payload);
            return;
        }
        inFlight = true;

        currentSessionId = call.getString("sessionId");
        currentRestaurantId = call.getString("restaurantId");
        currentBackendBaseUrl = call.getString("backendBaseUrl");
        currentTerminalLocationId = call.getString("terminalLocationId");
        currentFlowRunId = call.getString("flowRunId");

        if (isBlank(currentSessionId) || isBlank(currentRestaurantId) || isBlank(currentBackendBaseUrl) || isBlank(currentTerminalLocationId)) {
            inFlight = false;
            JSObject payload = result("failed", "session_error", "Missing required Tap to Pay parameters.");
            payload.put("detail", detail("native_prepare_entered", "missing_params", null));
            logStartupStage("native_prepare_result", payload);
            call.resolve(payload);
            return;
        }

        PermissionState permissionState = getPermissionState("location");
        JSObject permissionPayload = new JSObject();
        permissionPayload.put("permissionState", permissionStateToString(permissionState));
        permissionPayload.put("nativeStage", "native_prepare_permission_state");
        logStartupStage("native_prepare_permission_state", permissionPayload);

        if (permissionState != PermissionState.GRANTED) {
            inFlight = false;
            status = "failed";
            JSObject payload = result("failed", "permission_required", "Tap to Pay permission must be granted during kiosk setup.");
            payload.put("detail", detail("native_prepare_permission_state", "permission_not_granted", null));
            logStartupStage("native_prepare_result", payload);
            call.resolve(payload);
            return;
        }

        if (!isLocationServicesEnabled()) {
            inFlight = false;
            status = "failed";
            JSObject payload = result("failed", "unsupported", "Location services must be enabled for Tap to Pay.");
            payload.put("detail", detail("native_prepare_permission_state", "location_services_disabled", null));
            logStartupStage("native_prepare_result", payload);
            call.resolve(payload);
            return;
        }

        prepareAfterPermission(call);
    }

    private void prepareAfterPermission(PluginCall call) {
        status = "preparing";
        mainHandler.post(() -> {
            try {
                ensureTerminalInitialized();
            } catch (Exception e) {
                status = "failed";
                inFlight = false;
                JSObject payload = result("failed", normalizeErrorCode(e), e.getMessage());
                payload.put("detail", exceptionDetail(e, "native_prepare_entered", "terminal_init_failed"));
                logStartupStage("native_prepare_result", payload);
                call.resolve(payload);
                return;
            }

            if (connectedReader != null && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED) {
                status = "ready";
                inFlight = false;
                JSObject payload = result("ready", null, "Tap to Pay reader is already connected.");
                payload.put("detail", detail("native_prepare_result", "already_connected", null));
                logStartupStage("native_prepare_result", payload);
                call.resolve(payload);
                return;
            }

            discoverCancelable = Terminal.getInstance().discoverReaders(
                new DiscoveryConfiguration.TapToPayDiscoveryConfiguration(false),
                new DiscoveryListener() {
                    @Override
                    public void onUpdateDiscoveredReaders(List<Reader> readers) {
                        lastDiscoveredReaders = readers;
                    }
                },
                new Callback() {
                    @Override
                    public void onSuccess() {
                        if (lastDiscoveredReaders == null || lastDiscoveredReaders.isEmpty()) {
                            JSObject discoveryPayload = new JSObject();
                            discoveryPayload.put("result", "failed");
                            discoveryPayload.put("readersDiscovered", 0);
                            logStartupStage("native_discovery_result", discoveryPayload);
                            status = "failed";
                            inFlight = false;
                            JSObject payload = result("failed", "unsupported", "No Tap to Pay reader discovered on this device.");
                            payload.put("detail", detail("native_discovery_result", "no_readers", null));
                            logStartupStage("native_prepare_result", payload);
                            call.resolve(payload);
                            return;
                        }
                        JSObject discoveryPayload = new JSObject();
                        discoveryPayload.put("result", "success");
                        discoveryPayload.put("readersDiscovered", lastDiscoveredReaders.size());
                        discoveryPayload.put("readerLabel", lastDiscoveredReaders.get(0).getLabel());
                        logStartupStage("native_discovery_result", discoveryPayload);
                        Reader selected = lastDiscoveredReaders.get(0);
                        ConnectionConfiguration.TapToPayConnectionConfiguration config =
                            new ConnectionConfiguration.TapToPayConnectionConfiguration(currentTerminalLocationId, true, tapToPayReaderListener);

                        Terminal.getInstance().connectReader(
                            selected,
                            config,
                            new ReaderCallback() {
                                @Override
                                public void onSuccess(Reader reader) {
                                    connectedReader = reader;
                                    status = "ready";
                                    inFlight = false;
                                    discoverCancelable = null;
                                    JSObject connectionPayload = new JSObject();
                                    connectionPayload.put("result", "success");
                                    connectionPayload.put("readerLabel", reader.getLabel());
                                    logStartupStage("native_connection_result", connectionPayload);
                                    JSObject payload = result("ready", null, "Tap to Pay ready to collect payment.");
                                    payload.put("detail", detail("native_connection_result", "connected", null));
                                    logStartupStage("native_prepare_result", payload);
                                    call.resolve(payload);
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    status = "failed";
                                    inFlight = false;
                                    discoverCancelable = null;
                                    logStartupStage("native_connection_result", terminalFailurePayload("native_connection_result", e));
                                    JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                                    payload.put("detail", terminalErrorDetail(e, "native_connection_result"));
                                    logStartupStage("native_prepare_result", payload);
                                    call.resolve(payload);
                                }
                            }
                        );
                    }

                    @Override
                    public void onFailure(TerminalException e) {
                        status = "failed";
                        inFlight = false;
                        discoverCancelable = null;
                        logStartupStage("native_discovery_result", terminalFailurePayload("native_discovery_result", e));
                        JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                        payload.put("detail", terminalErrorDetail(e, "native_discovery_result"));
                        logStartupStage("native_prepare_result", payload);
                        call.resolve(payload);
                    }
                }
            );
        });
    }

    @PluginMethod
    public void startTapToPayPayment(PluginCall call) {
        logStartupStage("native_start_entered", new JSObject());
        beginRunTrace("startTapToPayPayment");
        JSObject startInvokedPayload = new JSObject();
        startInvokedPayload.put("hasConnectedReader", connectedReader != null);
        startInvokedPayload.put("terminalInitialized", Terminal.isInitialized());
        traceTimeline("start_tap_to_pay_invoked", startInvokedPayload);
        if (inFlight) {
            JSObject payload = result("failed", "native_busy", "Another Tap to Pay request is active.");
            payload.put("detail", detail("native_start_entered", "in_flight", null));
            logStartupStage("native_collect_result", payload);
            call.resolve(payload);
            return;
        }

        final String sessionId = call.getString("sessionId", "");
        final String restaurantId = call.getString("restaurantId", "");
        final String backendBaseUrl = call.getString("backendBaseUrl", "");
        final String terminalLocationId = call.getString("terminalLocationId", "");
        final String flowRunId = call.getString("flowRunId", "");

        if (sessionId.isEmpty() || restaurantId.isEmpty() || backendBaseUrl.isEmpty() || terminalLocationId.isEmpty()) {
            JSObject payload = result("failed", "session_error", "Missing required Tap to Pay parameters.");
            payload.put("detail", detail("native_start_entered", "missing_params", null));
            logStartupStage("native_collect_result", payload);
            call.resolve(payload);
            return;
        }

        currentSessionId = sessionId;
        currentRestaurantId = restaurantId;
        currentBackendBaseUrl = backendBaseUrl;
        currentTerminalLocationId = terminalLocationId;
        currentFlowRunId = flowRunId.isEmpty() ? null : flowRunId;
        traceTimeline("run_context_bound", null);
        clearCachedFinalResult("new_active_run_started");
        clearOperationTimeout();
        activePaymentIntent = null;
        processCancelable = null;

        if (connectedReader == null || !Terminal.isInitialized() || Terminal.getInstance().getConnectionStatus() != ConnectionStatus.CONNECTED) {
            JSObject payload = result("failed", "session_error", "Tap to Pay reader is not connected. Prepare Tap to Pay first.");
            payload.put("detail", detail("native_connection_result", "reader_not_connected", null));
            logStartupStage("native_connection_result", payload);
            logStartupStage("native_collect_result", payload);
            call.resolve(payload);
            return;
        }

        inFlight = true;
        status = "collecting";
        confirmedBackgroundInterruption = false;
        backgroundInterruptionCandidate = false;
        stripeTakeoverObserved = false;
        backgroundInterruptionCandidateAtMs = 0L;
        lifecyclePausedDuringActiveFlow = false;
        lastPauseAtMs = 0L;
        lastStopAtMs = 0L;
        AtomicBoolean resolveGate = new AtomicBoolean(false);
        startOperationTimeout(call, resolveGate);

        executor.execute(() -> {
            try {
                postJson(
                    backendBaseUrl + "/api/kiosk/payments/card-present/session-state",
                    "{\"session_id\":\"" + escapeJson(sessionId) + "\",\"restaurant_id\":\"" + escapeJson(restaurantId) + "\",\"next_state\":\"collecting\",\"event_type\":\"native_collect_start\"" + flowRunJsonFragment() + "}"
                );

                JSONObject piResponse = postJson(
                    backendBaseUrl + "/api/kiosk/payments/card-present/payment-intent",
                    "{\"session_id\":\"" + escapeJson(sessionId) + "\",\"restaurant_id\":\"" + escapeJson(restaurantId) + "\"}"
                );
                final String clientSecret = piResponse.optString("clientSecret", "");
                final String createdPaymentIntentId = piResponse.optString("paymentIntentId", "");
                final String createdPaymentIntentStatus = piResponse.optString("status", "");
                JSObject paymentIntentCreatedPayload = new JSObject();
                paymentIntentCreatedPayload.put("nativeStage", "native_payment_intent_created");
                paymentIntentCreatedPayload.put("paymentIntentId", createdPaymentIntentId.isEmpty() ? null : createdPaymentIntentId);
                paymentIntentCreatedPayload.put("paymentIntentStatus", createdPaymentIntentStatus.isEmpty() ? null : createdPaymentIntentStatus);
                logStartupStage("native_payment_intent_created", paymentIntentCreatedPayload);
                traceTimeline("payment_intent_created", paymentIntentCreatedPayload);
                if (clientSecret.isEmpty()) {
                    throw new IllegalStateException("PaymentIntent client secret missing from backend response.");
                }

                mainHandler.post(() -> Terminal.getInstance().retrievePaymentIntent(clientSecret, new PaymentIntentCallback() {
                    @Override
                    public void onSuccess(PaymentIntent paymentIntent) {
                        activePaymentIntent = paymentIntent;
                        JSObject collectStartPayload = new JSObject();
                        collectStartPayload.put("result", "started");
                        collectStartPayload.put("nativeStage", "native_collect_start");
                        collectStartPayload.put("paymentIntentId", paymentIntent.getId());
                        collectStartPayload.put("paymentIntentStatus", paymentIntent.getStatus() == null ? "unknown" : paymentIntent.getStatus().name());
                        logStartupStage("native_collect_start", collectStartPayload);
                        traceTimeline("collect_start_callback", collectStartPayload);
                        postSessionState("collecting", "native_collect_start");
                        status = "collecting";
                        JSObject collectInvokedPayload = lifecyclePayload("collect_payment_method_invoked");
                        collectInvokedPayload.put("paymentIntentId", paymentIntent.getId());
                        logFlowEvent("native_collect_invoked", collectInvokedPayload);
                        traceTimeline("collect_invoked", collectInvokedPayload);

                        Terminal.getInstance().collectPaymentMethod(
                            paymentIntent,
                            new PaymentIntentCallback() {
                                @Override
                                public void onSuccess(PaymentIntent collectedIntent) {
                                    activePaymentIntent = collectedIntent;
                                    JSObject collectPayload = new JSObject();
                                    collectPayload.put("result", "success");
                                    collectPayload.put("nativeStage", "native_collect_result");
                                    collectPayload.put("paymentIntentId", collectedIntent.getId());
                                    collectPayload.put(
                                        "paymentIntentStatus",
                                        collectedIntent.getStatus() == null ? "unknown" : collectedIntent.getStatus().name()
                                    );
                                    collectPayload.put("collectOutcome", "success");
                                    logStartupStage("native_collect_result", collectPayload);
                                    traceTimeline("collect_success_callback", collectPayload);

                                    JSObject processStartPayload = new JSObject();
                                    processStartPayload.put("result", "started");
                                    processStartPayload.put("nativeStage", "native_process_start");
                                    processStartPayload.put("paymentIntentId", collectedIntent.getId());
                                    processStartPayload.put("paymentIntentStatus", collectedIntent.getStatus() == null ? "unknown" : collectedIntent.getStatus().name());
                                    processStartPayload.put("processInvoked", true);
                                    logStartupStage("native_process_start", processStartPayload);
                                    traceTimeline("process_start", processStartPayload);
                                    postSessionState("processing", "native_process_start");
                                    status = "processing";
                                    JSObject processInvokedPayload = lifecyclePayload("process_payment_intent_invoked");
                                    processInvokedPayload.put("paymentIntentId", collectedIntent.getId());
                                    processInvokedPayload.put("paymentIntentStatus", collectedIntent.getStatus() == null ? "unknown" : collectedIntent.getStatus().name());
                                    logFlowEvent("native_process_invoked", processInvokedPayload);
                                    traceTimeline("process_invoked_before_sdk_call", processInvokedPayload);
                                    processCancelable = Terminal.getInstance().processPaymentIntent(
                                        collectedIntent,
                                        new CollectPaymentIntentConfiguration.Builder().build(),
                                        new ConfirmPaymentIntentConfiguration.Builder().build(),
                                        new PaymentIntentCallback() {
                                            @Override
                                            public void onSuccess(PaymentIntent intent) {
                                                activePaymentIntent = intent;
                                                JSObject processSuccessPayload = new JSObject();
                                                processSuccessPayload.put("paymentIntentStatus", intent.getStatus() == null ? "unknown" : intent.getStatus().name());
                                                traceTimeline("process_success_callback", processSuccessPayload);

                                                if (intent.getStatus() == PaymentIntentStatus.SUCCEEDED) {
                                                    postSessionState("processing", "native_process_succeeded");
                                                    JSObject payload = result("succeeded", null, "Tap to Pay payment processed by Stripe Terminal SDK.");
                                                    payload.put("detail", detail("native_process_result", "succeeded", intent.getStatus().name()));
                                                    attachPaymentIntentSnapshot(payload, intent, "process_success");
                                                    logStartupStage("native_process_result", payload);
                                                    cacheFinalResult(payload, "process_success");
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                } else if (intent.getStatus() == PaymentIntentStatus.PROCESSING || intent.getStatus() == PaymentIntentStatus.REQUIRES_CAPTURE) {
                                                    status = "processing";
                                                    postSessionState("needs_reconciliation", "native_process_pending");
                                                    JSObject payload = result("processing", null, "Stripe Terminal returned a pending PaymentIntent state.");
                                                    payload.put("detail", detail("native_process_result", "pending", intent.getStatus().name()));
                                                    attachPaymentIntentSnapshot(payload, intent, "process_pending");
                                                    logStartupStage("native_process_result", payload);
                                                    cacheFinalResult(payload, "process_pending");
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                } else {
                                                    status = "failed";
                                                    JSObject payload = result("failed", "processing_error", "Unexpected PaymentIntent status: " + intent.getStatus());
                                                    payload.put("detail", detail("native_process_result", "unexpected_status", String.valueOf(intent.getStatus())));
                                                    attachPaymentIntentSnapshot(payload, intent, "process_unexpected_status");
                                                    logStartupStage("native_process_result", payload);
                                                    cacheFinalResult(payload, "process_unexpected_status");
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                }
                                            }

                                            @Override
                                            public void onFailure(TerminalException e) {
                                                String normalizedCode = normalizeErrorCode(e);
                                                JSObject processFailurePayload = new JSObject();
                                                processFailurePayload.put("normalizedCode", normalizedCode);
                                                processFailurePayload.put("terminalCode", e.getErrorCode() == null ? "UNKNOWN" : e.getErrorCode().name());
                                                traceTimeline("process_failure_callback", processFailurePayload);
                                                String reasonCategory = classifyTerminalFailureCategory(normalizedCode);
                                                String mappedSessionState = mapSessionStateForFailureCategory(reasonCategory);
                                                String mappedPluginStatus = mapPluginStatusForFailureCategory(reasonCategory);
                                                status = mappedPluginStatus;
                                                if ("canceled".equals(normalizedCode)) {
                                                    logCancelOrCleanupPath(
                                                        "native_cancel_inevitable",
                                                        "startTapToPayPayment.processPaymentIntent.onFailure",
                                                        "terminal_reported_canceled"
                                                    );
                                                }
                                                postSessionState(mappedSessionState, "native_process_" + reasonCategory);
                                                JSObject payload = result(mappedPluginStatus, normalizedCode, buildErrorMessage(e));
                                                enrichOutcomePayload(payload, "native_process_result", e.getErrorCode(), "customer_cancelled".equals(reasonCategory));
                                                payload.put("reasonCategory", reasonCategory);
                                                payload.put("mappedSessionState", mappedSessionState);
                                                payload.put("interruptionReasonCode", "lifecycle_interrupted".equals(reasonCategory) ? "background_loss_confirmed" : "none");
                                                payload.put("detail", terminalErrorDetail(e, "native_process_result"));
                                                payload.put("interruptionSource", confirmedBackgroundInterruption ? "app_or_device_backgrounded" : (lifecyclePausedDuringActiveFlow ? "transient_lifecycle_change" : "none_detected"));
                                                payload.put("backgroundInterruptionCandidate", backgroundInterruptionCandidate);
                                                payload.put("backgroundInterruptionMs", backgroundInterruptionCandidateAtMs > 0 ? (System.currentTimeMillis() - backgroundInterruptionCandidateAtMs) : 0L);
                                                payload.put("cancelRequestedByApp", cancelRequestedByApp);
                                                payload.put("isProcessCancelableActive", processCancelable != null && !processCancelable.isCompleted());
                                                payload.put("pluginMarkedCanceledBeforeTerminal", cancelRequestedByApp);
                                                payload.put("readerDisconnectBeforeCallback", readerDisconnectedDuringActiveRun());
                                                payload.put("readerDisconnectReason", lastReaderDisconnectReason);
                                                payload.put("cancelClassification", determineCancelClassification(normalizedCode));
                                                attachPaymentIntentSnapshot(payload, activePaymentIntent, "process_failure_active_intent");
                                                logStartupStage("native_process_result", payload);
                                                cacheFinalResult(payload, "process_failure");
                                                clearActivePaymentState();
                                                resetStatusForNextAttempt();
                                                resolveOnce(resolveGate, call, payload);
                                            }
                                        }
                                    );
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    String normalizedCode = normalizeErrorCode(e);
                                    JSObject collectFailurePayload = new JSObject();
                                    collectFailurePayload.put("normalizedCode", normalizedCode);
                                    collectFailurePayload.put("terminalCode", e.getErrorCode() == null ? "UNKNOWN" : e.getErrorCode().name());
                                    traceTimeline("collect_failure_callback", collectFailurePayload);
                                    String reasonCategory = classifyTerminalFailureCategory(normalizedCode);
                                    String mappedSessionState = mapSessionStateForFailureCategory(reasonCategory);
                                    String mappedPluginStatus = mapPluginStatusForFailureCategory(reasonCategory);
                                    status = mappedPluginStatus;
                                    if ("canceled".equals(normalizedCode)) {
                                        logCancelOrCleanupPath(
                                            "native_cancel_inevitable",
                                            "startTapToPayPayment.collectPaymentMethod.onFailure",
                                            "terminal_reported_canceled"
                                        );
                                    }
                                    postSessionState(mappedSessionState, "native_collect_" + reasonCategory);
                                    JSObject payload = result(mappedPluginStatus, normalizedCode, buildErrorMessage(e));
                                    enrichOutcomePayload(payload, "native_collect_result", e.getErrorCode(), "customer_cancelled".equals(reasonCategory));
                                    payload.put("reasonCategory", reasonCategory);
                                    payload.put("mappedSessionState", mappedSessionState);
                                    payload.put("interruptionReasonCode", "lifecycle_interrupted".equals(reasonCategory) ? "background_loss_confirmed" : "none");
                                    payload.put("detail", terminalErrorDetail(e, "native_collect_result"));
                                    payload.put("interruptionSource", confirmedBackgroundInterruption ? "app_or_device_backgrounded" : (lifecyclePausedDuringActiveFlow ? "transient_lifecycle_change" : "none_detected"));
                                    payload.put("backgroundInterruptionCandidate", backgroundInterruptionCandidate);
                                    payload.put("backgroundInterruptionMs", backgroundInterruptionCandidateAtMs > 0 ? (System.currentTimeMillis() - backgroundInterruptionCandidateAtMs) : 0L);
                                    payload.put("collectOutcome", "failure");
                                    attachPaymentIntentSnapshot(payload, activePaymentIntent, "collect_failure_active_intent");
                                    logStartupStage("native_collect_result", payload);
                                    cacheFinalResult(payload, "collect_failure");
                                    clearActivePaymentState();
                                    resetStatusForNextAttempt();
                                    resolveOnce(resolveGate, call, payload);
                                }
                            },
                            new CollectPaymentIntentConfiguration.Builder().build()
                        );
                    }

                    @Override
                    public void onFailure(TerminalException e) {
                        traceTimeline("retrieve_payment_intent_failure", null);
                        status = "failed";
                        JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                        payload.put("detail", terminalErrorDetail(e, "native_collect_result"));
                        logStartupStage("native_collect_result", payload);
                        cacheFinalResult(payload, "retrieve_payment_intent_failure");
                        clearActivePaymentState();
                        resetStatusForNextAttempt();
                        resolveOnce(resolveGate, call, payload);
                    }
                }));
            } catch (Exception ex) {
                traceTimeline("start_exception", null);
                status = "failed";
                JSObject payload = result("failed", normalizeErrorCode(ex), ex.getMessage());
                payload.put("detail", exceptionDetail(ex, "native_collect_result", "start_exception"));
                logStartupStage("native_collect_result", payload);
                cacheFinalResult(payload, "start_exception");
                clearActivePaymentState();
                resetStatusForNextAttempt();
                resolveOnce(resolveGate, call, payload);
            }
        });
    }

    @PluginMethod
    public void cancelTapToPayPayment(PluginCall call) {
        clearOperationTimeout();
        cancelRequestedByApp = true;
        traceTimeline("explicit_cancel_plugin_method_invoked", null);
        logCancelSource("plugin_method:cancelTapToPayPayment");
        logCancelOrCleanupPath("native_cancel_path_observed", "plugin_method:cancelTapToPayPayment", "explicit_staff_cancel_request");
        logStartupStage("native_cancel_result", detail("native_cancel_result", "entered", null));
        mainHandler.post(() -> {
            try {
                if (processCancelable != null && !processCancelable.isCompleted()) {
                    traceTimeline("explicit_cancel_processCancelable_cancel_called", null);
                    logCancelSource("plugin_method:processCancelable.cancel");
                    logCancelOrCleanupPath("native_cancel_path_observed", "plugin_method:processCancelable.cancel", "processCancelable_cancel_requested");
                    processCancelable.cancel(new Callback() {
                        @Override
                        public void onSuccess() {
                            status = "canceled";
                            postSessionState("canceled", "native_cancel");
                            JSObject payload = result("canceled", "canceled", "Tap to Pay canceled.");
                            payload.put("detail", detail("native_cancel_result", "process_cancelable_canceled", null));
                            logStartupStage("native_cancel_result", payload);
                            cacheFinalResult(payload, "cancel_process_cancelable");
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }

                        @Override
                        public void onFailure(TerminalException e) {
                            status = "failed";
                            JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                            payload.put("detail", terminalErrorDetail(e, "native_cancel_result"));
                            logStartupStage("native_cancel_result", payload);
                            cacheFinalResult(payload, "cancel_process_failure");
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }
                    });
                    return;
                }

                if (activePaymentIntent != null && Terminal.isInitialized()) {
                    traceTimeline("explicit_cancel_payment_intent_cancel_called", null);
                    logCancelSource("plugin_method:cancelPaymentIntent");
                    logCancelOrCleanupPath("native_cancel_path_observed", "plugin_method:cancelPaymentIntent", "cancel_payment_intent_requested");
                    Terminal.getInstance().cancelPaymentIntent(activePaymentIntent, new PaymentIntentCallback() {
                        @Override
                        public void onSuccess(PaymentIntent paymentIntent) {
                            status = "canceled";
                            postSessionState("canceled", "native_cancel");
                            JSObject payload = result("canceled", "canceled", "Tap to Pay canceled.");
                            payload.put("detail", detail("native_cancel_result", "payment_intent_canceled", null));
                            logStartupStage("native_cancel_result", payload);
                            cacheFinalResult(payload, "cancel_payment_intent");
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }

                        @Override
                        public void onFailure(TerminalException e) {
                            status = "failed";
                            JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                            payload.put("detail", terminalErrorDetail(e, "native_cancel_result"));
                            logStartupStage("native_cancel_result", payload);
                            cacheFinalResult(payload, "cancel_payment_intent_failure");
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }
                    });
                    return;
                }

                status = "canceled";
                logCancelOrCleanupPath("native_cancel_path_observed", "plugin_method:no_active_payment", "no_active_payment");
                JSObject payload = result("canceled", "canceled", "No active payment was running.");
                payload.put("detail", detail("native_cancel_result", "no_active_payment", null));
                logStartupStage("native_cancel_result", payload);
                cacheFinalResult(payload, "cancel_no_active");
                clearActivePaymentState();
                resetStatusForNextAttempt();
                call.resolve(payload);
            } catch (Exception ex) {
                status = "failed";
                JSObject payload = result("failed", normalizeErrorCode(ex), ex.getMessage());
                payload.put("detail", exceptionDetail(ex, "native_cancel_result", "cancel_exception"));
                logStartupStage("native_cancel_result", payload);
                cacheFinalResult(payload, "cancel_exception");
                clearActivePaymentState();
                resetStatusForNextAttempt();
                call.resolve(payload);
            }
        });
    }

    @PluginMethod
    public void getTapToPayStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("inFlight", inFlight);
        result.put("connected", connectedReader != null && Terminal.isInitialized() && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED);
        if (currentSessionId != null) {
            result.put("sessionId", currentSessionId);
        }
        call.resolve(result);
    }


    @PluginMethod
    public void getActivePaymentRunState(PluginCall call) {
        JSObject payload = new JSObject();
        boolean connected = connectedReader != null && Terminal.isInitialized() && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED;
        payload.put("status", status);
        payload.put("inFlight", inFlight);
        payload.put("connected", connected);
        payload.put("activeRun", isCollectOrProcessActive());
        payload.put("stripeTakeoverActive", stripeTakeoverObserved);
        payload.put("appBackgrounded", isAppInBackground());
        if (currentSessionId != null) payload.put("sessionId", currentSessionId);
        if (currentRestaurantId != null) payload.put("restaurantId", currentRestaurantId);
        if (currentTerminalLocationId != null) payload.put("terminalLocationId", currentTerminalLocationId);
        if (currentFlowRunId != null) payload.put("flowRunId", currentFlowRunId);
        if (cachedFinalResult != null) {
            payload.put("cachedFinalResult", cachedFinalResult);
            payload.put("cachedFinalResultAtMs", cachedFinalResultAtMs);
        }
        logStartupStage("native_active_run_state_result", payload);
        call.resolve(payload);
    }

    @PluginMethod
    public void lockPaymentOrientationToPortrait(PluginCall call) {
        mainHandler.post(() -> {
            try {
                if (getActivity() == null) {
                    JSObject payload = new JSObject();
                    payload.put("locked", false);
                    payload.put("reason", "Activity unavailable");
                    call.resolve(payload);
                    return;
                }
                getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                JSObject payload = new JSObject();
                payload.put("locked", true);
                call.resolve(payload);
            } catch (Exception ex) {
                JSObject payload = new JSObject();
                payload.put("locked", false);
                payload.put("reason", ex.getMessage() == null ? "Failed to lock orientation" : ex.getMessage());
                call.resolve(payload);
            }
        });
    }

    @PluginMethod
    public void unlockPaymentOrientation(PluginCall call) {
        mainHandler.post(() -> {
            try {
                if (getActivity() == null) {
                    JSObject payload = new JSObject();
                    payload.put("unlocked", false);
                    payload.put("reason", "Activity unavailable");
                    call.resolve(payload);
                    return;
                }
                getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                JSObject payload = new JSObject();
                payload.put("unlocked", true);
                call.resolve(payload);
            } catch (Exception ex) {
                JSObject payload = new JSObject();
                payload.put("unlocked", false);
                payload.put("reason", ex.getMessage() == null ? "Failed to unlock orientation" : ex.getMessage());
                call.resolve(payload);
            }
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        lastResumeAtMs = System.currentTimeMillis();
        if (inFlight) {
            // Stripe Tap to Pay collection can temporarily pause/stop the host Activity while the SDK takes over.
            // Returning to onResume means the foreground handoff recovered, so clear candidate interruption state.
            confirmedBackgroundInterruption = false;
            backgroundInterruptionCandidate = false;
            backgroundInterruptionCandidateAtMs = 0L;
        }
        logLifecycleEvent("onResume");
        traceTimeline("plugin_handleOnResume", null);
        if (Terminal.isInitialized() && connectedReader != null && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED) {
            if (!inFlight && ("failed".equals(status) || "idle".equals(status))) {
                status = "ready";
            }
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        lastPauseAtMs = System.currentTimeMillis();
        if (inFlight && ("collecting".equals(status) || "processing".equals(status))) {
            stripeTakeoverObserved = true;
        }
        logLifecycleEvent("onPause");
        traceTimeline("plugin_handleOnPause", null);
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        logLifecycleEvent("onStart");
        traceTimeline("plugin_handleOnStart", null);
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        lastStopAtMs = System.currentTimeMillis();
        boolean appInBackground = isAppInBackground();
        boolean changingConfigurations = getActivity() != null && getActivity().isChangingConfigurations();
        logLifecycleEvent("onStop");
        traceTimeline("plugin_handleOnStop", null);
        if (inFlight && ("collecting".equals(status) || "processing".equals(status))) {
            stripeTakeoverObserved = true;
            lifecyclePausedDuringActiveFlow = true;
            if (appInBackground && !changingConfigurations) {
                backgroundInterruptionCandidate = true;
                if (backgroundInterruptionCandidateAtMs <= 0L) {
                    backgroundInterruptionCandidateAtMs = System.currentTimeMillis();
                }
                long candidateMs = System.currentTimeMillis() - backgroundInterruptionCandidateAtMs;
                confirmedBackgroundInterruption = candidateMs >= BACKGROUND_INTERRUPTION_MIN_MS;
            } else {
                confirmedBackgroundInterruption = false;
                backgroundInterruptionCandidate = false;
                backgroundInterruptionCandidateAtMs = 0L;
                logStartupStage("native_lifecycle", detail("native_lifecycle", "transient_stop_during_terminal_takeover", status));
            }
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        JSObject payload = lifecyclePayload("onActivityResult");
        payload.put("requestCode", requestCode);
        payload.put("resultCode", resultCode);
        payload.put("hasDataIntent", data != null);
        logStartupStage("native_lifecycle", payload);
        traceTimeline("plugin_handleOnActivityResult", payload);
    }

    @Override
    protected void handleOnDestroy() {
        traceTimeline("plugin_handleOnDestroy_entered", null);
        logCancelOrCleanupPath("native_cleanup_path_observed", "plugin_handleOnDestroy", "handleOnDestroy_entered");
        if (isCollectOrProcessActive()) {
            JSObject activeRunPayload = paymentRunGuardPayload("plugin_handleOnDestroy", "active_collect_or_process_run_detected");
            activeRunPayload.put("action", "suppress_destructive_cleanup_during_active_run");
            activeRunPayload.put("willShutdownExecutor", false);
            activeRunPayload.put("willClearReader", false);
            activeRunPayload.put("willClearPaymentIntent", false);
            logFlowEvent("native_cleanup_suppressed", activeRunPayload);
            super.handleOnDestroy();
            return;
        }
        clearOperationTimeout();
        if (discoverCancelable != null && !discoverCancelable.isCompleted()) {
            traceTimeline("discoverCancelable_cancel_called_during_destroy", null);
            logCancelOrCleanupPath("native_cleanup_path_observed", "plugin_handleOnDestroy.discoverCancelable.cancel", "discover_cancelable_cleanup");
            discoverCancelable.cancel(new Callback() {
                @Override
                public void onSuccess() {}
                @Override
                public void onFailure(TerminalException e) {}
            });
        }
        if (processCancelable != null && !processCancelable.isCompleted()) {
            JSObject payload = lifecyclePayload("handleOnDestroy_processCancelable_active");
            payload.put("action", "left_active_to_avoid_forced_cancel");
            logFlowEvent("native_cancel_suppressed", payload);
            traceTimeline("processCancelable_left_active_during_destroy", null);
        }
        discoverCancelable = null;
        processCancelable = null;
        connectedReader = null;
        activePaymentIntent = null;
        inFlight = false;
        logCancelOrCleanupPath("native_cleanup_path_observed", "plugin_handleOnDestroy.executor.shutdownNow", "plugin_destroy_cleanup");
        traceTimeline("plugin_executor_shutdown", null);
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private JSObject result(String status, String code, String message) {
        JSObject obj = new JSObject();
        obj.put("status", status);
        obj.put("terminalStatus", status);
        if (code != null) {
            obj.put("code", code);
        }
        if (message != null) {
            obj.put("message", message);
        }
        obj.put("stripeTakeoverActive", stripeTakeoverObserved);
        obj.put("appBackgrounded", isAppInBackground());
        obj.put("definitiveCustomerCancelSignal", false);
        return obj;
    }

    private void enrichOutcomePayload(JSObject payload, String nativeStage, TerminalErrorCode terminalCode, boolean definitiveCustomerCancelSignal) {
        payload.put("nativeStage", nativeStage);
        payload.put("terminalCode", terminalCode == null ? "UNKNOWN" : terminalCode.name());
        payload.put("terminalStatus", payload.getString("status"));
        payload.put("stripeTakeoverActive", stripeTakeoverObserved);
        payload.put("appBackgrounded", isAppInBackground());
        payload.put("definitiveCustomerCancelSignal", definitiveCustomerCancelSignal);
    }


    private void attachPaymentIntentSnapshot(JSObject payload, PaymentIntent intent, String source) {
        if (payload == null || intent == null) return;
        payload.put("paymentIntentSource", source);
        payload.put("paymentIntentId", intent.getId());
        payload.put("paymentIntentStatus", intent.getStatus() == null ? "unknown" : intent.getStatus().name());
    }

    private void ensureTerminalInitialized() throws TerminalException {
        if (Terminal.isInitialized()) {
            return;
        }
        LogLevel logLevel = isDebugBuild() ? LogLevel.VERBOSE : LogLevel.NONE;
        Terminal.init(getContext(), logLevel, connectionTokenProvider, terminalListener, null);
    }

    private JSONObject postJson(String targetUrl, String body) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(targetUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(20_000);
            conn.setReadTimeout(20_000);

            byte[] data = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }

            int code = conn.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String payload = readBody(stream);
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("Backend request failed with status " + code + (payload.isEmpty() ? "" : (": " + payload)));
            }
            return payload.isEmpty() ? new JSONObject() : new JSONObject(payload);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void postSessionState(String nextState, String eventType) {
        if (isBlank(currentSessionId) || isBlank(currentRestaurantId) || isBlank(currentBackendBaseUrl)) {
            return;
        }

        executor.execute(() -> {
            try {
                String payloadBody = "{\"session_id\":\"" + escapeJson(currentSessionId) + "\",\"restaurant_id\":\"" + escapeJson(currentRestaurantId) + "\",\"next_state\":\"" + escapeJson(nextState) + "\",\"event_type\":\"" + escapeJson(eventType) + "\"" + flowRunJsonFragment() + "}";
                JSObject dbWritePayload = lifecyclePayload("native_session_state_post");
                dbWritePayload.put("nextState", nextState);
                dbWritePayload.put("eventType", eventType);
                dbWritePayload.put("requestPayload", payloadBody);
                logStartupStage("native_session_state_post", dbWritePayload);
                postJson(
                    currentBackendBaseUrl + "/api/kiosk/payments/card-present/session-state",
                    payloadBody
                );
            } catch (Exception e) {
                if (isDebugBuild()) {
                    Log.w(TAG, "Failed to sync session state", e);
                }
            }
        });
    }

    private void startOperationTimeout(PluginCall call, AtomicBoolean resolveGate) {
        clearOperationTimeout();
        timeoutRunnable = () -> {
            if (inFlight) {
                status = "failed";
                postSessionState("needs_reconciliation", "native_timeout");
                if (processCancelable != null && !processCancelable.isCompleted()) {
                    logCancelSource("operation_timeout");
                    traceTimeline("operation_timeout_processCancelable_cancel_called", null);
                    processCancelable.cancel(new Callback() {
                        @Override
                        public void onSuccess() {}
                        @Override
                        public void onFailure(TerminalException e) {}
                    });
                }
                JSObject payload = result("failed", "processing_error", "Tap to Pay timed out. Please retry.");
                payload.put("reasonCategory", "timeout");
                payload.put("detail", detail("native_process_result", "timeout", null));
                logStartupStage("native_process_result", payload);
                cacheFinalResult(payload, "operation_timeout");
                clearActivePaymentState();
                resetStatusForNextAttempt();
                resolveOnce(resolveGate, call, payload);
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, OPERATION_TIMEOUT_MS);
    }

    private void resolveOnce(AtomicBoolean gate, PluginCall call, JSObject payload) {
        if (gate.compareAndSet(false, true)) {
            call.resolve(payload);
        }
    }

    private void clearOperationTimeout() {
        if (timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
            timeoutRunnable = null;
        }
    }

    private String readBody(InputStream inputStream) throws Exception {
        if (inputStream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        }
    }

    private String normalizeErrorCode(Exception error) {
        if (error instanceof TerminalException) {
            return normalizeTerminalErrorCode((TerminalException) error);
        }
        if (error instanceof IllegalStateException) return "session_error";
        return "processing_error";
    }

    private String normalizeTerminalErrorCode(TerminalException error) {
        TerminalErrorCode code = error.getErrorCode();
        if (code == null) return "processing_error";
        switch (code) {
            case CANCELED:
            case CANCEL_FAILED:
                return "canceled";
            case REQUEST_TIMED_OUT:
            case STRIPE_API_CONNECTION_ERROR:
                return "network_error";
            case TAP_TO_PAY_UNSUPPORTED_DEVICE:
                return "unsupported_device";
            case TAP_TO_PAY_UNSUPPORTED_ANDROID_VERSION:
            case TAP_TO_PAY_NFC_DISABLED:
            case TAP_TO_PAY_PIN_UNAVAILABLE:
            case TAP_TO_PAY_INSECURE_ENVIRONMENT:
            case TAP_TO_PAY_DEVICE_TAMPERED:
            case TAP_TO_PAY_DEBUG_NOT_SUPPORTED:
                return "unsupported";
            default:
                return "processing_error";
        }
    }

    private String buildErrorMessage(TerminalException error) {
        if (error.getErrorMessage() != null && !error.getErrorMessage().isEmpty()) {
            return error.getErrorMessage();
        }
        return error.getMessage() != null ? error.getMessage() : "Tap to Pay operation failed.";
    }

    private String classifyTerminalFailureCategory(String normalizedCode) {
        if ("canceled".equals(normalizedCode)) {
            if (cancelRequestedByApp) return "app_cancelled";
            if (
                isConfirmedLifecycleInterruption()
                    || stripeTakeoverObserved
                    || lifecyclePausedDuringActiveFlow
                    || backgroundInterruptionCandidate
            ) {
                return "lifecycle_interrupted";
            }
            return "customer_cancelled";
        }
        return "collect_failed";
    }

    private String mapSessionStateForFailureCategory(String reasonCategory) {
        if ("customer_cancelled".equals(reasonCategory) || "app_cancelled".equals(reasonCategory)) {
            return "canceled";
        }
        if ("lifecycle_interrupted".equals(reasonCategory)) {
            return "needs_reconciliation";
        }
        return "failed";
    }

    private String mapPluginStatusForFailureCategory(String reasonCategory) {
        if ("customer_cancelled".equals(reasonCategory) || "app_cancelled".equals(reasonCategory)) {
            return "canceled";
        }
        if ("lifecycle_interrupted".equals(reasonCategory)) {
            return "processing";
        }
        return "failed";
    }

    private boolean isConfirmedLifecycleInterruption() {
        if (confirmedBackgroundInterruption && isAppInBackground()) {
            return true;
        }
        if (!backgroundInterruptionCandidate || backgroundInterruptionCandidateAtMs <= 0L) {
            return false;
        }
        long elapsed = System.currentTimeMillis() - backgroundInterruptionCandidateAtMs;
        boolean currentlyBackgrounded = isAppInBackground();
        return currentlyBackgrounded && elapsed >= BACKGROUND_INTERRUPTION_MIN_MS;
    }


    private boolean isAppInBackground() {
        try {
            ActivityManager activityManager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) return false;
            ActivityManager.RunningAppProcessInfo appProcessInfo = new ActivityManager.RunningAppProcessInfo();
            ActivityManager.getMyMemoryState(appProcessInfo);
            return appProcessInfo.importance != ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                && appProcessInfo.importance != ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String flowRunJsonFragment() {
        return isBlank(currentFlowRunId) ? "" : ",\"flow_run_id\":\"" + escapeJson(currentFlowRunId) + "\"";
    }

    private void logStartupStage(String stage, JSObject payload) {
        if (!isBlank(currentFlowRunId) && !payload.has("flowRunId")) {
            payload.put("flowRunId", currentFlowRunId);
        }
        if (!isBlank(currentSessionId) && !payload.has("sessionId")) {
            payload.put("sessionId", currentSessionId);
        }
        Log.i(TAG, "[kiosk][" + stage + "] " + payload.toString());
    }

    private JSObject lifecyclePayload(String rawEventName) {
        JSObject payload = detail("native_lifecycle", rawEventName, inFlight ? status : "idle");
        payload.put("pluginInstanceId", pluginInstanceId);
        payload.put("activeRunSequence", activeRunSequence);
        payload.put("monotonicElapsedMs", SystemClock.elapsedRealtime());
        payload.put("runMonotonicDeltaMs", monotonicRunDeltaMs());
        payload.put("rawEventName", rawEventName);
        payload.put("inFlight", inFlight);
        payload.put("status", status);
        payload.put("timestampMs", System.currentTimeMillis());
        payload.put("pauseMsAgo", lastPauseAtMs > 0 ? (System.currentTimeMillis() - lastPauseAtMs) : null);
        payload.put("stopMsAgo", lastStopAtMs > 0 ? (System.currentTimeMillis() - lastStopAtMs) : null);
        payload.put("resumeMsAgo", lastResumeAtMs > 0 ? (System.currentTimeMillis() - lastResumeAtMs) : null);
        payload.put("activityHasWindowFocus", getActivity() != null && getActivity().hasWindowFocus());
        payload.put("appInBackground", isAppInBackground());
        payload.put("activityChangingConfigurations", getActivity() != null && getActivity().isChangingConfigurations());
        payload.put("confirmedBackgroundInterruption", confirmedBackgroundInterruption);
        payload.put("backgroundInterruptionCandidate", backgroundInterruptionCandidate);
        payload.put("backgroundInterruptionMs", backgroundInterruptionCandidateAtMs > 0 ? (System.currentTimeMillis() - backgroundInterruptionCandidateAtMs) : 0L);
        payload.put("collectOrProcessActive", isCollectOrProcessActive());
        payload.put("takeoverActive", stripeTakeoverObserved);
        return payload;
    }

    private void logLifecycleEvent(String rawEventName) {
        logStartupStage("native_lifecycle", lifecyclePayload(rawEventName));
    }

    private JSObject terminalFailurePayload(String stage, TerminalException e) {
        JSObject payload = new JSObject();
        payload.put("result", "failed");
        payload.put("code", normalizeErrorCode(e));
        payload.put("message", buildErrorMessage(e));
        payload.put("detail", terminalErrorDetail(e, stage));
        return payload;
    }

    private JSObject terminalErrorDetail(TerminalException e, String stage) {
        JSObject detail = new JSObject();
        TerminalErrorCode terminalCode = e.getErrorCode();
        detail.put("nativeStage", stage);
        detail.put("terminalCode", terminalCode == null ? "UNKNOWN" : terminalCode.name());
        detail.put("message", buildErrorMessage(e));
        detail.put("exceptionClass", e.getClass().getName());
        detail.put("exceptionMessage", e.getMessage());
        if (terminalCode == TerminalErrorCode.TAP_TO_PAY_UNSUPPORTED_DEVICE) {
            detail.put("unsupportedDevice", true);
            detail.put("unsupportedDevicePermanent", true);
            detail.put("unsupportedReason", "This Android device does not meet Stripe Tap to Pay hardware/security requirements.");
        }
        if (e.getCause() != null && e.getCause().getMessage() != null) {
            detail.put("cause", e.getCause().getMessage());
        }
        if (e.getCause() != null) {
            detail.put("causeClass", e.getCause().getClass().getName());
        }
        detail.put("stackTop", topStack(e, 6));
        return detail;
    }

    private JSObject exceptionDetail(Exception e, String stage, String reason) {
        JSObject detail = new JSObject();
        detail.put("nativeStage", stage);
        detail.put("reason", reason);
        detail.put("exceptionClass", e.getClass().getSimpleName());
        if (e.getMessage() != null) {
            detail.put("exceptionMessage", e.getMessage());
        }
        return detail;
    }

    private JSObject detail(String stage, String reason, String extra) {
        JSObject detail = new JSObject();
        detail.put("nativeStage", stage);
        detail.put("reason", reason);
        if (extra != null) {
            detail.put("extra", extra);
        }
        return detail;
    }

    private String permissionStateToString(PermissionState state) {
        if (state == null) return "unknown";
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.PROMPT) return "prompt";
        if (state == PermissionState.PROMPT_WITH_RATIONALE) return "prompt_with_rationale";
        if (state == PermissionState.DENIED) return "denied";
        return String.valueOf(state);
    }

    private boolean isLocationServicesEnabled() {
        try {
            LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) return false;
            return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void beginRunTrace(String source) {
        activeRunSequence += 1;
        activeRunMonotonicStartNs = SystemClock.elapsedRealtimeNanos();
        lastReaderDisconnectElapsedMs = 0L;
        lastReaderDisconnectReason = "none";
        JSObject payload = new JSObject();
        payload.put("source", source);
        traceTimeline("run_trace_started", payload);
    }

    private void traceTimeline(String event, JSObject extra) {
        JSObject payload = lifecyclePayload("native_timeline:" + event);
        payload.put("timelineEvent", event);
        if (extra != null) {
            java.util.Iterator<String> keys = extra.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                payload.put(key, extra.opt(key));
            }
        }
        logStartupStage("native_timeline", payload);
    }

    private long monotonicRunDeltaMs() {
        if (activeRunMonotonicStartNs <= 0L) return 0L;
        return (SystemClock.elapsedRealtimeNanos() - activeRunMonotonicStartNs) / 1_000_000L;
    }

    private boolean readerDisconnectedDuringActiveRun() {
        if (lastReaderDisconnectElapsedMs <= 0L || activeRunMonotonicStartNs <= 0L) {
            return false;
        }
        long runStartElapsedMs = activeRunMonotonicStartNs / 1_000_000L;
        return lastReaderDisconnectElapsedMs >= runStartElapsedMs;
    }

    private String determineCancelClassification(String normalizedCode) {
        if (!"canceled".equals(normalizedCode)) {
            return "not_canceled_error";
        }
        if (cancelRequestedByApp) {
            return "explicit_app_cancel";
        }
        if (readerDisconnectedDuringActiveRun() || lifecyclePausedDuringActiveFlow || backgroundInterruptionCandidate || confirmedBackgroundInterruption) {
            return "ambiguous_lifecycle_or_disconnect_before_callback";
        }
        return "sdk_or_customer_cancel_without_local_cancel_signal";
    }

    private String topStack(Throwable throwable, int maxFrames) {
        if (throwable == null || throwable.getStackTrace() == null || throwable.getStackTrace().length == 0) {
            return "none";
        }
        StackTraceElement[] trace = throwable.getStackTrace();
        StringBuilder builder = new StringBuilder();
        int limit = Math.min(maxFrames, trace.length);
        for (int i = 0; i < limit; i++) {
            if (i > 0) builder.append(" <- ");
            builder.append(trace[i].getClassName())
                .append(".")
                .append(trace[i].getMethodName())
                .append(":")
                .append(trace[i].getLineNumber());
        }
        return builder.toString();
    }
}
