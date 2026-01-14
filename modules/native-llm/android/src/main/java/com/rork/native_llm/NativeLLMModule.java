package com.rork.native_llm;

import android.os.Handler;
import android.os.Looper;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class NativeLLMModule extends ReactContextBaseJavaModule {
    static {
        System.loadLibrary("native_llm_jni");
    }

    private long handle = 0;
    private final ReactApplicationContext reactContext;

    public NativeLLMModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "native-llm";
    }

    @ReactMethod
    public void loadModel(ReadableMap params, Promise promise) {
        String modelPath = params.getString("modelPath");
        int nThreads = Runtime.getRuntime().availableProcessors();
        int nCtx = 2048;
        handle = nativeInit(modelPath, nThreads, nCtx);
        if (handle != 0) {
            promise.resolve(Arguments.createMap().putBoolean("ok", true).putString("engine", "llama.cpp"));
        } else {
            promise.reject("LOAD_ERROR", "Failed to load model");
        }
    }

    @ReactMethod
    public void generate(ReadableMap params, Promise promise) {
        String prompt = params.getString("prompt");
        int maxTokens = params.hasKey("maxTokens") ? params.getInt("maxTokens") : 128;
        float temperature = params.hasKey("temperature") ? (float) params.getDouble("temperature") : 0.8f;
        int topK = params.hasKey("topK") ? params.getInt("topK") : 40;
        int seed = params.hasKey("seed") ? params.getInt("seed") : 0;
        String requestId = java.util.UUID.randomUUID().toString();
        new Thread(() -> {
            nativeGenerate(handle, requestId, prompt, maxTokens, temperature, topK, seed, new Callback() {
                @Override
                public void onToken(String reqId, String token) {
                    sendEvent("llmEvent", Arguments.createMap()
                        .putString("type", "token")
                        .putString("requestId", reqId)
                        .putString("token", token));
                }
                @Override
                public void onDone(String reqId, String output) {
                    sendEvent("llmEvent", Arguments.createMap()
                        .putString("type", "done")
                        .putString("requestId", reqId)
                        .putString("output", output));
                    promise.resolve(Arguments.createMap().putString("requestId", reqId));
                }
                @Override
                public void onError(String reqId, String message) {
                    sendEvent("llmEvent", Arguments.createMap()
                        .putString("type", "error")
                        .putString("requestId", reqId)
                        .putString("message", message));
                    promise.reject("GEN_ERROR", message);
                }
            });
        }).start();
    }

    @ReactMethod
    public void stop(String requestId, Promise promise) {
        nativeStop(requestId);
        promise.resolve(Arguments.createMap().putBoolean("ok", true));
    }

    @ReactMethod
    public void status(Promise promise) {
        boolean loaded = handle != 0;
        WritableMap map = Arguments.createMap();
        map.putBoolean("loaded", loaded);
        map.putString("engine", "llama.cpp");
        map.putString("version", "llama.cpp-native");
        promise.resolve(map);
    }

    @ReactMethod
    public void health(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("ok", true);
        map.putString("details", "Native LLM healthy");
        promise.resolve(map);
    }

    private void sendEvent(String eventName, WritableMap params) {
        new Handler(Looper.getMainLooper()).post(() ->
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params)
        );
    }

    private native long nativeInit(String modelPath, int nThreads, int nCtx);
    private native void nativeFree(long handle);
    private native void nativeStop(String requestId);
    private native void nativeGenerate(long handle, String requestId, String prompt, int maxTokens, float temperature, int topK, int seed, Callback callback);

    public interface Callback {
        void onToken(String requestId, String token);
        void onDone(String requestId, String output);
        void onError(String requestId, String message);
    }
}
