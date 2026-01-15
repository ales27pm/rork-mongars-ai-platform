#include <jni.h>
#include <string>
#include <vector>
#include <atomic>
#include "llama.h"

static llama_model * g_model = nullptr;
static llama_context* g_ctx = nullptr;
static std::atomic<bool> g_cancelled(false);

extern "C" JNIEXPORT jlong JNICALL
Java_com_rork_native_llm_NativeLLM_nativeInit(JNIEnv* env, jobject thiz, jstring modelPath_, jint nThreads, jint nCtx) {
    const char* modelPath = env->GetStringUTFChars(modelPath_, nullptr);
    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0; // CPU only for now
    g_model = llama_model_load_from_file(modelPath, mparams);
    env->ReleaseStringUTFChars(modelPath_, modelPath);
    if (!g_model) return 0;

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = static_cast<uint32_t>(nCtx);
    cparams.n_threads = static_cast<int32_t>(nThreads);
    g_ctx = llama_init_from_model(g_model, cparams);
    return reinterpret_cast<jlong>(g_ctx);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeFree(JNIEnv* env, jobject thiz, jlong handle) {
    llama_context* ctx = reinterpret_cast<llama_context*>(handle);
    if (ctx) {
        llama_free(ctx);
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    g_ctx = nullptr;
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeStop(JNIEnv* env, jobject thiz, jstring requestId_) {
    g_cancelled.store(true);
}

extern "C" JNIEXPORT void JNICALL
Java_com_rork_native_llm_NativeLLM_nativeGenerate(JNIEnv* env, jobject thiz, jlong handle, jstring requestId_, jstring prompt_, jint maxTokens, jfloat temperature, jint topK, jint seed, jobject callback) {
    llama_context* ctx = reinterpret_cast<llama_context*>(handle);
    if (!ctx || !g_model) return;

    const char* prompt = env->GetStringUTFChars(prompt_, nullptr);
    const char* requestId = env->GetStringUTFChars(requestId_, nullptr);
    g_cancelled.store(false);

    // Tokenize prompt using model vocab
    const struct llama_vocab * vocab = llama_model_get_vocab(g_model);
    int32_t text_len = static_cast<int32_t>(strlen(prompt));
    int32_t n_tokens_max = std::max(1024, text_len * 4 + 8);
    std::vector<llama_token> tokens(n_tokens_max);
    int32_t n_prompt = llama_tokenize(vocab, prompt, text_len, tokens.data(), n_tokens_max, true, false);
    if (n_prompt < 0) n_prompt = 0;

    // process prompt
    if (n_prompt > 0) {
        llama_batch batch = llama_batch_get_one(tokens.data(), n_prompt);
        llama_decode(ctx, batch);
    }

    // prepare sampler chain
    auto sparams = llama_sampler_chain_default_params();
    struct llama_sampler * smpl = llama_sampler_chain_init(sparams);
    if (topK > 0) {
        llama_sampler_chain_add(smpl, llama_sampler_init_top_k(topK));
    }
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
    // add dist sampler to actually select token
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(static_cast<uint32_t>(seed)));

    std::string output;

    jclass cbClass = env->GetObjectClass(callback);
    jmethodID onToken = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;Ljava/lang/String;)V");
    jmethodID onDone = env->GetMethodID(cbClass, "onDone", "(Ljava/lang/String;Ljava/lang/String;)V");

    for (int i = 0; i < maxTokens && !g_cancelled.load(); ++i) {
        llama_token token = llama_sampler_sample(smpl, ctx, -1);
        if (token == LLAMA_TOKEN_NULL) break;

        // evaluate the new token
        llama_batch nb = llama_batch_get_one(&token, 1);
        llama_decode(ctx, nb);

        const char * piece = llama_vocab_get_text(vocab, token);
        std::string token_str = piece ? piece : "";
        output += token_str;

        // Call back into Java/Kotlin for token event
        jstring jToken = env->NewStringUTF(token_str.c_str());
        env->CallVoidMethod(callback, onToken, env->NewStringUTF(requestId), jToken);
        env->DeleteLocalRef(jToken);
    }

    // Done event
    env->CallVoidMethod(callback, onDone, env->NewStringUTF(requestId), env->NewStringUTF(output.c_str()));

    // cleanup
    llama_sampler_free(smpl);
    env->ReleaseStringUTFChars(prompt_, prompt);
    env->ReleaseStringUTFChars(requestId_, requestId);
}
