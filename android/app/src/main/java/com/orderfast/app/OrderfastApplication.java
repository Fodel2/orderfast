package com.orderfast.app;

import android.app.Application;

import com.stripe.stripeterminal.TerminalApplicationDelegate;

public class OrderfastApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        TerminalApplicationDelegate.onCreate(this);
    }
}
