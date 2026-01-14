#include <jni.h>
#include <string>
#include <atomic>
#include "llama.h"

static llama_context* g_ctx = nullptr;
static std::atomic<bool> g_cancelled(false);

extern "C" JNIEXPORT jlong JNICALL
Java_com_rork_native_llm_NativeLLM_nativeInit(JNIEnv* env, jobject thiz, jstring modelPath_, jint nThreads, jint nCtx) {
    const char* modelPath = env->GetStringUTFChars(modelPath_, nullptr);
    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0; // CPU only for now, can be tuned
    llama_model* model = llama_load_model_from_file(modelPath, model_params);
    env->ReleaseStringUTFChars(modelPath_, modelPath);
    if (!model) return 0;
    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = nCtx;
    ctx_params.n_threads = nThreads;
    g_ctx = llama_new_context_with_model(model, ctx_params);
    return reinterpret_cast<jlong>(g_ctx);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeFree(JNIEnv* env, jobject thiz, jlong handle) {
    llama_context* ctx = reinterpret_cast<llama_context*>(handle);
    llama_free(ctx);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeStop(JNIEnv* env, jobject thiz, jstring requestId_) {
    g_cancelled.store(true);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeGenerate(JNIEnv* env, jobject thiz, jlong handle, jstring requestId_, jstring prompt_, jint maxTokens, jfloat temperature, jint topK, jint seed, jobject callback) {
    llama_context* ctx = reinterpret_cast<llama_context*>(handle);
    const char* prompt = env->GetStringUTFChars(prompt_, nullptr);
    const char* requestId = env->GetStringUTFChars(requestId_, nullptr);
    g_cancelled.store(false);

    // Tokenize prompt
    std::vector<llama_token> tokens(llama_tokenize(ctx, prompt, true));
    int n_prompt = tokens.size();
    llama_eval(ctx, tokens.data(), n_prompt, 0, 1);

    std::string output;
    for (int i = 0; i < maxTokens && !g_cancelled.load(); ++i) {
        llama_token token = llama_sample_top_k(ctx, topK, temperature);
        llama_eval(ctx, &token, 1, n_prompt + i, 1);
        std::string token_str = llama_token_to_str(ctx, token);
        output += token_str;
        // Call back into Java/Kotlin for token event
        jclass cbClass = env->GetObjectClass(callback);
        jmethodID onToken = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;Ljava/lang/String;)V");
        jstring jToken = env->NewStringUTF(token_str.c_str());
        env->CallVoidMethod(callback, onToken, env->NewStringUTF(requestId), jToken);
        env->DeleteLocalRef(jToken);
    }
    // Done event
    jclass cbClass = env->GetObjectClass(callback);
    jmethodID onDone = env->GetMethodID(cbClass, "onDone", "(Ljava/lang/String;Ljava/lang/String;)V");
    env->CallVoidMethod(callback, onDone, env->NewStringUTF(requestId), env->NewStringUTF(output.c_str()));
    env->ReleaseStringUTFChars(prompt_, prompt);
    env->ReleaseStringUTFChars(requestId_, requestId);
}
