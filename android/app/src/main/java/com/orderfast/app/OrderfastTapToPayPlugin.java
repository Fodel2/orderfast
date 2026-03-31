package com.orderfast.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OrderfastTapToPay")
public class OrderfastTapToPayPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile String status = "idle";
    private volatile boolean inFlight = false;

    @PluginMethod
    public void isTapToPaySupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("reason", "Android kiosk bridge available");
        call.resolve(result);
    }

    @PluginMethod
    public void prepareTapToPay(PluginCall call) {
        if (inFlight) {
            call.resolve(result("failed", "native_busy", "Another Tap to Pay request is active."));
            return;
        }

        status = "preparing";
        call.resolve(result("ready", null, "Tap to Pay bridge prepared."));
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

        inFlight = true;
        status = "processing";

        executor.execute(() -> {
            try {
                postJson(
                    backendBaseUrl + "/api/kiosk/payments/card-present/session-state",
                    "{\"session_id\":\"" + sessionId + "\",\"restaurant_id\":\"" + restaurantId + "\",\"next_state\":\"processing\",\"event_type\":\"native_start\"}"
                );
                status = "succeeded";
                call.resolve(result("succeeded", null, "Tap to Pay session completed in native bridge."));
            } catch (Exception ex) {
                status = "failed";
                call.resolve(result("failed", "processing_error", ex.getMessage()));
            } finally {
                inFlight = false;
            }
        });
    }

    @PluginMethod
    public void cancelTapToPayPayment(PluginCall call) {
        status = "canceled";
        inFlight = false;
        call.resolve(result("canceled", "canceled", "Tap to Pay canceled."));
    }

    @PluginMethod
    public void getTapToPayStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", status);
        call.resolve(result);
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

    private void postJson(String targetUrl, String body) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(targetUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            byte[] data = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(data.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("Backend request failed with status " + code);
            }
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
