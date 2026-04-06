package com.orderfast.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

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
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private volatile String status = "idle";
    private volatile boolean inFlight = false;
    private volatile String currentSessionId = null;
    private volatile String currentRestaurantId = null;
    private volatile String currentBackendBaseUrl = null;
    private volatile String currentTerminalLocationId = null;
    private volatile Reader connectedReader = null;
    private volatile PaymentIntent activePaymentIntent = null;
    private volatile Cancelable discoverCancelable = null;
    private volatile Cancelable processCancelable = null;
    private volatile Runnable timeoutRunnable = null;
    private volatile List<Reader> lastDiscoveredReaders = null;
    private volatile PluginCall pendingSetupPermissionCall = null;

    private void clearActivePaymentState() {
        clearOperationTimeout();
        activePaymentIntent = null;
        processCancelable = null;
        inFlight = false;
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
            if (isDebugBuild()) {
                Log.d(TAG, "Reader disconnected: " + reason);
            }
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
        boolean hasLocationPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean locationServicesEnabled = isLocationServicesEnabled();
        PermissionState locationPermissionState = getPermissionState("location");

        if (!hasNfc) {
            result.put("supported", false);
            result.put("reason", "NFC is not available on this device.");
        } else if (!hasLocationPermission) {
            result.put("supported", false);
            result.put("reason", "Location permission is required for Tap to Pay.");
        } else if (!locationServicesEnabled) {
            result.put("supported", false);
            result.put("reason", "Location services must be enabled for Tap to Pay.");
        } else {
            result.put("supported", true);
            result.put("reason", "Tap to Pay prerequisites satisfied.");
        }
        result.put("permissionState", permissionStateToString(locationPermissionState));
        result.put("hasNfc", hasNfc);
        result.put("locationServicesEnabled", locationServicesEnabled);
        result.put("nativeStage", "native_support_check_result");
        logStartupStage("native_support_check_result", result);
        call.resolve(result);
    }

    @PluginMethod
    public void ensureTapToPaySetup(PluginCall call) {
        boolean promptIfNeeded = call.getBoolean("promptIfNeeded", false);
        boolean hasNfc = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC);
        boolean hasLocationPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean locationServicesEnabled = isLocationServicesEnabled();
        PermissionState permissionState = getPermissionState("location");

        if (!hasNfc) {
            JSObject payload = new JSObject();
            payload.put("ready", false);
            payload.put("supported", false);
            payload.put("reason", "NFC is not available on this device.");
            payload.put("permissionState", permissionStateToString(permissionState));
            payload.put("locationServicesEnabled", locationServicesEnabled);
            payload.put("nativeStage", "native_setup_result");
            call.resolve(payload);
            return;
        }

        if (!hasLocationPermission && promptIfNeeded) {
            pendingSetupPermissionCall = call;
            requestPermissionForAlias("location", call, "setupPermissionCallback");
            return;
        }

        JSObject payload = new JSObject();
        payload.put("ready", hasLocationPermission && locationServicesEnabled);
        payload.put("supported", hasNfc);
        payload.put("reason", !hasLocationPermission
            ? "Location permission is required for Tap to Pay."
            : (locationServicesEnabled
                ? "Tap to Pay device prerequisites satisfied."
                : "Location services must be enabled for Tap to Pay."));
        payload.put("permissionState", permissionStateToString(permissionState));
        payload.put("locationServicesEnabled", locationServicesEnabled);
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

        boolean hasLocationPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean locationServicesEnabled = isLocationServicesEnabled();
        PermissionState permissionState = getPermissionState("location");

        JSObject payload = new JSObject();
        payload.put("ready", hasLocationPermission && locationServicesEnabled);
        payload.put("supported", true);
        payload.put("reason", !hasLocationPermission
            ? "Location permission is required for Tap to Pay."
            : (locationServicesEnabled
                ? "Tap to Pay device prerequisites satisfied."
                : "Location services must be enabled for Tap to Pay."));
        payload.put("permissionState", permissionStateToString(permissionState));
        payload.put("locationServicesEnabled", locationServicesEnabled);
        payload.put("nativeStage", "native_setup_result");
        call.resolve(payload);
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
        AtomicBoolean resolveGate = new AtomicBoolean(false);
        startOperationTimeout(call, resolveGate);

        executor.execute(() -> {
            try {
                postJson(
                    backendBaseUrl + "/api/kiosk/payments/card-present/session-state",
                    "{\"session_id\":\"" + escapeJson(sessionId) + "\",\"restaurant_id\":\"" + escapeJson(restaurantId) + "\",\"next_state\":\"collecting\",\"event_type\":\"native_collect_start\"}"
                );

                JSONObject piResponse = postJson(
                    backendBaseUrl + "/api/kiosk/payments/card-present/payment-intent",
                    "{\"session_id\":\"" + escapeJson(sessionId) + "\",\"restaurant_id\":\"" + escapeJson(restaurantId) + "\"}"
                );
                final String clientSecret = piResponse.optString("clientSecret", "");
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
                        postSessionState("collecting", "native_collect_start");
                        status = "collecting";

                        Terminal.getInstance().collectPaymentMethod(
                            paymentIntent,
                            new CollectPaymentIntentConfiguration.Builder().build(),
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
                                    logStartupStage("native_collect_result", collectPayload);

                                    JSObject processStartPayload = new JSObject();
                                    processStartPayload.put("result", "started");
                                    processStartPayload.put("nativeStage", "native_process_start");
                                    processStartPayload.put("paymentIntentId", collectedIntent.getId());
                                    logStartupStage("native_process_start", processStartPayload);
                                    postSessionState("processing", "native_process_start");
                                    status = "processing";
                                    processCancelable = Terminal.getInstance().processPaymentIntent(
                                        collectedIntent,
                                        new ConfirmPaymentIntentConfiguration.Builder().build(),
                                        new PaymentIntentCallback() {
                                            @Override
                                            public void onSuccess(PaymentIntent intent) {
                                                activePaymentIntent = intent;

                                                if (intent.getStatus() == PaymentIntentStatus.SUCCEEDED) {
                                                    postSessionState("processing", "native_process_succeeded");
                                                    JSObject payload = result("succeeded", null, "Tap to Pay payment processed by Stripe Terminal SDK.");
                                                    payload.put("detail", detail("native_process_result", "succeeded", intent.getStatus().name()));
                                                    logStartupStage("native_process_result", payload);
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                } else if (intent.getStatus() == PaymentIntentStatus.PROCESSING || intent.getStatus() == PaymentIntentStatus.REQUIRES_CAPTURE) {
                                                    status = "processing";
                                                    postSessionState("needs_reconciliation", "native_process_pending");
                                                    JSObject payload = result("processing", null, "Stripe Terminal returned a pending PaymentIntent state.");
                                                    payload.put("detail", detail("native_process_result", "pending", intent.getStatus().name()));
                                                    logStartupStage("native_process_result", payload);
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                } else {
                                                    status = "failed";
                                                    JSObject payload = result("failed", "processing_error", "Unexpected PaymentIntent status: " + intent.getStatus());
                                                    payload.put("detail", detail("native_process_result", "unexpected_status", String.valueOf(intent.getStatus())));
                                                    logStartupStage("native_process_result", payload);
                                                    clearActivePaymentState();
                                                    resetStatusForNextAttempt();
                                                    resolveOnce(resolveGate, call, payload);
                                                }
                                            }

                                            @Override
                                            public void onFailure(TerminalException e) {
                                                status = "failed";
                                                postSessionState("failed", "native_process_failed");
                                                JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                                                payload.put("detail", terminalErrorDetail(e, "native_process_result"));
                                                logStartupStage("native_process_result", payload);
                                                clearActivePaymentState();
                                                resetStatusForNextAttempt();
                                                resolveOnce(resolveGate, call, payload);
                                            }
                                        }
                                    );
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    status = "failed";
                                    postSessionState("failed", "native_collect_failed");
                                    JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                                    payload.put("detail", terminalErrorDetail(e, "native_collect_result"));
                                    logStartupStage("native_collect_result", payload);
                                    clearActivePaymentState();
                                    resetStatusForNextAttempt();
                                    resolveOnce(resolveGate, call, payload);
                                }
                            }
                        );
                    }

                    @Override
                    public void onFailure(TerminalException e) {
                        status = "failed";
                        JSObject payload = result("failed", normalizeErrorCode(e), buildErrorMessage(e));
                        payload.put("detail", terminalErrorDetail(e, "native_collect_result"));
                        logStartupStage("native_collect_result", payload);
                        clearActivePaymentState();
                        resetStatusForNextAttempt();
                        resolveOnce(resolveGate, call, payload);
                    }
                }));
            } catch (Exception ex) {
                status = "failed";
                JSObject payload = result("failed", normalizeErrorCode(ex), ex.getMessage());
                payload.put("detail", exceptionDetail(ex, "native_collect_result", "start_exception"));
                logStartupStage("native_collect_result", payload);
                clearActivePaymentState();
                resetStatusForNextAttempt();
                resolveOnce(resolveGate, call, payload);
            }
        });
    }

    @PluginMethod
    public void cancelTapToPayPayment(PluginCall call) {
        clearOperationTimeout();
        logStartupStage("native_cancel_result", detail("native_cancel_result", "entered", null));
        mainHandler.post(() -> {
            try {
                if (processCancelable != null && !processCancelable.isCompleted()) {
                    processCancelable.cancel(new Callback() {
                        @Override
                        public void onSuccess() {
                            status = "canceled";
                            postSessionState("canceled", "native_cancel");
                            JSObject payload = result("canceled", "canceled", "Tap to Pay canceled.");
                            payload.put("detail", detail("native_cancel_result", "process_cancelable_canceled", null));
                            logStartupStage("native_cancel_result", payload);
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
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }
                    });
                    return;
                }

                if (activePaymentIntent != null && Terminal.isInitialized()) {
                    Terminal.getInstance().cancelPaymentIntent(activePaymentIntent, new PaymentIntentCallback() {
                        @Override
                        public void onSuccess(PaymentIntent paymentIntent) {
                            status = "canceled";
                            postSessionState("canceled", "native_cancel");
                            JSObject payload = result("canceled", "canceled", "Tap to Pay canceled.");
                            payload.put("detail", detail("native_cancel_result", "payment_intent_canceled", null));
                            logStartupStage("native_cancel_result", payload);
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
                            clearActivePaymentState();
                            resetStatusForNextAttempt();
                            call.resolve(payload);
                        }
                    });
                    return;
                }

                status = "canceled";
                JSObject payload = result("canceled", "canceled", "No active payment was running.");
                payload.put("detail", detail("native_cancel_result", "no_active_payment", null));
                logStartupStage("native_cancel_result", payload);
                clearActivePaymentState();
                resetStatusForNextAttempt();
                call.resolve(payload);
            } catch (Exception ex) {
                status = "failed";
                JSObject payload = result("failed", normalizeErrorCode(ex), ex.getMessage());
                payload.put("detail", exceptionDetail(ex, "native_cancel_result", "cancel_exception"));
                logStartupStage("native_cancel_result", payload);
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
        if (Terminal.isInitialized() && connectedReader != null && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED) {
            if (!inFlight && ("failed".equals(status) || "idle".equals(status))) {
                status = "ready";
            }
        }
        if (inFlight && ("collecting".equals(status) || "processing".equals(status))) {
            postSessionState("needs_reconciliation", "native_resumed_during_inflight");
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (inFlight && ("collecting".equals(status) || "processing".equals(status))) {
            postSessionState("needs_reconciliation", "native_backgrounded");
        }
    }

    @Override
    protected void handleOnDestroy() {
        clearOperationTimeout();
        if (discoverCancelable != null && !discoverCancelable.isCompleted()) {
            discoverCancelable.cancel(new Callback() {
                @Override
                public void onSuccess() {}
                @Override
                public void onFailure(TerminalException e) {}
            });
        }
        if (processCancelable != null && !processCancelable.isCompleted()) {
            processCancelable.cancel(new Callback() {
                @Override
                public void onSuccess() {}
                @Override
                public void onFailure(TerminalException e) {}
            });
        }
        discoverCancelable = null;
        processCancelable = null;
        connectedReader = null;
        activePaymentIntent = null;
        inFlight = false;
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private JSObject result(String status, String code, String message) {
        JSObject obj = new JSObject();
        obj.put("status", status);
        if (code != null) {
            obj.put("code", code);
        }
        if (message != null) {
            obj.put("message", message);
        }
        return obj;
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
                postJson(
                    currentBackendBaseUrl + "/api/kiosk/payments/card-present/session-state",
                    "{\"session_id\":\"" + escapeJson(currentSessionId) + "\",\"restaurant_id\":\"" + escapeJson(currentRestaurantId) + "\",\"next_state\":\"" + escapeJson(nextState) + "\",\"event_type\":\"" + escapeJson(eventType) + "\"}"
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
                    processCancelable.cancel(new Callback() {
                        @Override
                        public void onSuccess() {}
                        @Override
                        public void onFailure(TerminalException e) {}
                    });
                }
                JSObject payload = result("failed", "processing_error", "Tap to Pay timed out. Please retry.");
                payload.put("detail", detail("native_process_result", "timeout", null));
                logStartupStage("native_process_result", payload);
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

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void logStartupStage(String stage, JSObject payload) {
        Log.i(TAG, "[kiosk][" + stage + "] " + payload.toString());
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
        if (terminalCode == TerminalErrorCode.TAP_TO_PAY_UNSUPPORTED_DEVICE) {
            detail.put("unsupportedDevice", true);
            detail.put("unsupportedDevicePermanent", true);
            detail.put("unsupportedReason", "This Android device does not meet Stripe Tap to Pay hardware/security requirements.");
        }
        if (e.getCause() != null && e.getCause().getMessage() != null) {
            detail.put("cause", e.getCause().getMessage());
        }
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
}
