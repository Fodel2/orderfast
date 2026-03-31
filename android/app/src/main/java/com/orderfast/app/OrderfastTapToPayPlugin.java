package com.orderfast.app;

import android.Manifest;
import android.content.pm.PackageManager;
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
    private volatile Reader connectedReader = null;
    private volatile PaymentIntent activePaymentIntent = null;
    private volatile Cancelable discoverCancelable = null;
    private volatile Cancelable processCancelable = null;
    private volatile Runnable timeoutRunnable = null;
    private volatile List<Reader> lastDiscoveredReaders = null;

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
            if (BuildConfig.DEBUG) {
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
            if (BuildConfig.DEBUG) {
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
            if (BuildConfig.DEBUG) {
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
        JSObject result = new JSObject();
        boolean hasNfc = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC);
        boolean hasLocationPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (!hasNfc) {
            result.put("supported", false);
            result.put("reason", "NFC is not available on this device.");
        } else if (!hasLocationPermission) {
            result.put("supported", false);
            result.put("reason", "Location permission is required for Tap to Pay.");
        } else {
            result.put("supported", true);
            result.put("reason", "Tap to Pay prerequisites satisfied.");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void prepareTapToPay(PluginCall call) {
        if (inFlight) {
            call.resolve(result("failed", "native_busy", "Another Tap to Pay request is active."));
            return;
        }
        inFlight = true;

        currentSessionId = call.getString("sessionId");
        currentRestaurantId = call.getString("restaurantId");
        currentBackendBaseUrl = call.getString("backendBaseUrl");

        if (isBlank(currentSessionId) || isBlank(currentRestaurantId) || isBlank(currentBackendBaseUrl)) {
            inFlight = false;
            call.resolve(result("failed", "session_error", "Missing required Tap to Pay parameters."));
            return;
        }

        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "preparePermissionCallback");
            return;
        }

        prepareAfterPermission(call);
    }

    @PermissionCallback
    public void preparePermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            inFlight = false;
            call.resolve(result("failed", "unsupported", "Location permission is required for Tap to Pay."));
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
                call.resolve(result("failed", normalizeErrorCode(e), e.getMessage()));
                return;
            }

            if (connectedReader != null && Terminal.getInstance().getConnectionStatus() == ConnectionStatus.CONNECTED) {
                status = "ready";
                inFlight = false;
                call.resolve(result("ready", null, "Tap to Pay reader is already connected."));
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
                            status = "failed";
                            inFlight = false;
                            call.resolve(result("failed", "unsupported", "No Tap to Pay reader discovered on this device."));
                            return;
                        }
                        Reader selected = lastDiscoveredReaders.get(0);
                        ConnectionConfiguration.TapToPayConnectionConfiguration config =
                            new ConnectionConfiguration.TapToPayConnectionConfiguration("Orderfast", true, tapToPayReaderListener);

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
                                    call.resolve(result("ready", null, "Tap to Pay ready to collect payment."));
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    status = "failed";
                                    inFlight = false;
                                    discoverCancelable = null;
                                    call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                                }
                            }
                        );
                    }

                    @Override
                    public void onFailure(TerminalException e) {
                        status = "failed";
                        inFlight = false;
                        discoverCancelable = null;
                        call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                    }
                }
            );
        });
    }

    @PluginMethod
    public void startTapToPayPayment(PluginCall call) {
        if (inFlight) {
            call.resolve(result("failed", "native_busy", "Another Tap to Pay request is active."));
            return;
        }

        final String sessionId = call.getString("sessionId", "");
        final String restaurantId = call.getString("restaurantId", "");
        final String backendBaseUrl = call.getString("backendBaseUrl", "");

        if (sessionId.isEmpty() || restaurantId.isEmpty() || backendBaseUrl.isEmpty()) {
            call.resolve(result("failed", "session_error", "Missing required Tap to Pay parameters."));
            return;
        }

        currentSessionId = sessionId;
        currentRestaurantId = restaurantId;
        currentBackendBaseUrl = backendBaseUrl;

        if (connectedReader == null || !Terminal.isInitialized() || Terminal.getInstance().getConnectionStatus() != ConnectionStatus.CONNECTED) {
            call.resolve(result("failed", "session_error", "Tap to Pay reader is not connected. Prepare Tap to Pay first."));
            return;
        }

        inFlight = true;
        status = "collecting";
        startOperationTimeout(call);

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
                        postSessionState("processing", "native_process_start");
                        status = "processing";
                        processCancelable = Terminal.getInstance().processPaymentIntent(
                            paymentIntent,
                            new com.stripe.stripeterminal.external.models.CollectPaymentIntentConfiguration.Builder().build(),
                            new com.stripe.stripeterminal.external.models.ConfirmPaymentIntentConfiguration.Builder().build(),
                            new PaymentIntentCallback() {
                                @Override
                                public void onSuccess(PaymentIntent intent) {
                                    activePaymentIntent = intent;
                                    clearOperationTimeout();

                                    if (intent.getStatus() == PaymentIntentStatus.SUCCEEDED || intent.getStatus() == PaymentIntentStatus.PROCESSING || intent.getStatus() == PaymentIntentStatus.REQUIRES_CAPTURE) {
                                        status = "succeeded";
                                        postSessionState("processing", "native_process_succeeded");
                                        call.resolve(result("succeeded", null, "Tap to Pay payment processed by Stripe Terminal SDK."));
                                    } else {
                                        status = "failed";
                                        call.resolve(result("failed", "processing_error", "Unexpected PaymentIntent status: " + intent.getStatus()));
                                    }
                                    processCancelable = null;
                                    inFlight = false;
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    clearOperationTimeout();
                                    status = "failed";
                                    inFlight = false;
                                    postSessionState("failed", "native_process_failed");
                                    processCancelable = null;
                                    call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                                }
                            }
                        );
                    }

                    @Override
                    public void onFailure(TerminalException e) {
                        clearOperationTimeout();
                        status = "failed";
                        inFlight = false;
                        call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                    }
                }));
            } catch (Exception ex) {
                clearOperationTimeout();
                status = "failed";
                inFlight = false;
                call.resolve(result("failed", normalizeErrorCode(ex), ex.getMessage()));
            }
        });
    }

    @PluginMethod
    public void cancelTapToPayPayment(PluginCall call) {
        clearOperationTimeout();
        mainHandler.post(() -> {
            try {
                if (processCancelable != null && !processCancelable.isCompleted()) {
                    processCancelable.cancel(new Callback() {
                        @Override
                        public void onSuccess() {
                            status = "canceled";
                            inFlight = false;
                            postSessionState("canceled", "native_cancel");
                            call.resolve(result("canceled", "canceled", "Tap to Pay canceled."));
                        }

                        @Override
                        public void onFailure(TerminalException e) {
                            status = "failed";
                            inFlight = false;
                            call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                        }
                    });
                    return;
                }

                if (activePaymentIntent != null && Terminal.isInitialized()) {
                    Terminal.getInstance().cancelPaymentIntent(activePaymentIntent, new PaymentIntentCallback() {
                        @Override
                        public void onSuccess(PaymentIntent paymentIntent) {
                            status = "canceled";
                            inFlight = false;
                            postSessionState("canceled", "native_cancel");
                            call.resolve(result("canceled", "canceled", "Tap to Pay canceled."));
                        }

                        @Override
                        public void onFailure(TerminalException e) {
                            status = "failed";
                            inFlight = false;
                            call.resolve(result("failed", normalizeErrorCode(e), buildErrorMessage(e)));
                        }
                    });
                    return;
                }

                status = "canceled";
                inFlight = false;
                processCancelable = null;
                call.resolve(result("canceled", "canceled", "No active payment was running."));
            } catch (Exception ex) {
                status = "failed";
                inFlight = false;
                call.resolve(result("failed", normalizeErrorCode(ex), ex.getMessage()));
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
        LogLevel logLevel = BuildConfig.DEBUG ? LogLevel.VERBOSE : LogLevel.NONE;
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
                if (BuildConfig.DEBUG) {
                    Log.w(TAG, "Failed to sync session state", e);
                }
            }
        });
    }

    private void startOperationTimeout(PluginCall call) {
        clearOperationTimeout();
        timeoutRunnable = () -> {
            if (inFlight) {
                status = "failed";
                inFlight = false;
                call.resolve(result("failed", "processing_error", "Tap to Pay timed out. Please retry."));
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, OPERATION_TIMEOUT_MS);
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
            case TAP_TO_PAY_UNSUPPORTED_ANDROID_VERSION:
            case TAP_TO_PAY_UNSUPPORTED_DEVICE:
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

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
