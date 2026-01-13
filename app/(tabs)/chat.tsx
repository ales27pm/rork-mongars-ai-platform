import { Stack } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import {
  Send,
  Brain,
  Clipboard as ClipboardIcon,
  Mic,
  Volume2,
  StopCircle,
} from "lucide-react-native";
import { useCognition } from "@/lib/providers/cognition";
import { useHippocampus } from "@/lib/providers/hippocampus";
import { useModelManager } from "@/lib/providers/model-manager";
import { useMicrophone } from "@/lib/hooks/useMicrophone";
import type { Message } from "@/types";
import type { ReflectionResult } from "@/types/introspection";
import { format } from "date-fns";

export default function ChatScreen() {
  const cognition = useCognition();
  const hippocampus = useHippocampus();
  const modelManager = useModelManager();
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    isRecording,
    isWebSupported,
    requestPermission,
    startRecording,
    stopRecording,
  } = useMicrophone();

  const messages = hippocampus.shortTermMemory;
  const hasLoadedModel = modelManager.loadedModelId != null;

  const detectIntrospectionCommand = useCallback(
    (
      text: string,
    ): {
      isCommand: boolean;
      type?: "reflect" | "audit" | "inspect";
      query?: string;
    } => {
      const lower = text.toLowerCase().trim();

      if (
        lower === "audit" ||
        lower === "audit self" ||
        lower === "self-audit"
      ) {
        return { isCommand: true, type: "audit" };
      }

      if (
        lower === "inspect" ||
        lower === "inspect self" ||
        lower.startsWith("inspect state")
      ) {
        return { isCommand: true, type: "inspect" };
      }

      if (
        lower.startsWith("reflect") ||
        lower.includes("look inside") ||
        lower.includes("introspect")
      ) {
        return { isCommand: true, type: "reflect", query: text };
      }

      return { isCommand: false };
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || cognition.isGenerating) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    await hippocampus.storeMessage(userMessage);
    const commandDetection = detectIntrospectionCommand(input.trim());
    setInput("");
    setStreamingText("");

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    if (commandDetection.isCommand) {
      try {
        let result: ReflectionResult;

        if (commandDetection.type === "audit") {
          result = await cognition.auditSelf();
        } else if (commandDetection.type === "inspect") {
          const state = cognition.inspectCognitiveState();
          result = {
            query: "Inspect cognitive state",
            timestamp: Date.now(),
            summary: `Currently ${state.modulesEngaged.length} modules engaged. Confidence: ${state.confidenceLevel.toFixed(2)}. Temperature: ${state.temperature}.`,
            insights: [
              {
                category: "behavior",
                observation: `Active modules: ${state.modulesEngaged.join(", ")}`,
                confidence: 1.0,
              },
              {
                category: "performance",
                observation: `Memory context: ${state.memoryContext.shortTermCount} short-term, ${state.memoryContext.longTermAccessed} long-term`,
                confidence: 1.0,
              },
            ],
            recommendations: ["Continue monitoring"],
          };
        } else {
          result = await cognition.reflect(
            commandDetection.query || input.trim(),
          );
        }

        const responseMsg: Message = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: `[Introspection: ${commandDetection.type}]\n\n${result.summary}\n\nInsights:\n${result.insights.map((i) => `• [${i.category}] ${i.observation}`).join("\n")}\n\nRecommendations:\n${result.recommendations.map((r) => `• ${r}`).join("\n")}`,
          timestamp: Date.now(),
          confidence: 1.0,
          source: "local",
          metadata: { introspection: true },
        };

        await hippocampus.storeMessage(responseMsg);
      } catch (error) {
        console.error("[Chat] Introspection command failed:", error);
        const errorMsg: Message = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: `Introspection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
          confidence: 0.1,
          source: "local",
        };
        await hippocampus.storeMessage(errorMsg);
      }
    } else {
      await cognition.generateResponse(input.trim(), (chunk) => {
        setStreamingText((prev) => prev + chunk);
      });
    }

    setStreamingText("");

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [input, cognition, hippocampus, detectIntrospectionCommand]);

  const copyMessage = useCallback(async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert("Copied", "Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy:", error);
      Alert.alert("Error", "Failed to copy message");
    }
  }, []);

  const pasteToInput = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setInput((prev) => prev + text);
      }
    } catch (error) {
      console.error("Failed to paste:", error);
    }
  }, []);

  const handleVoiceInput = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        "Please enable microphone access to use voice input.",
      );
      return;
    }

    if (Platform.OS === "web" && !isWebSupported) {
      Alert.alert(
        "Unsupported",
        "Voice recording is not available in this browser.",
      );
      return;
    }

    if (!isRecording) {
      try {
        await startRecording();
      } catch (error) {
        console.error("[STT] Failed to start recording:", error);
        Alert.alert(
          "Error",
          "Failed to start recording. Please check microphone permissions.",
        );
      }
      return;
    }

    setIsTranscribing(true);

    try {
      const result = await stopRecording();
      if (!result || (!result.blob && !result.uri)) {
        throw new Error("No audio data captured");
      }

      const formData = new FormData();

      if (Platform.OS === "web" && result.blob) {
        formData.append("audio", result.blob, "recording.webm");
      } else if (result.uri) {
        const uriParts = result.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];

        const audioFile = {
          uri: result.uri,
          name: `recording.${fileType}`,
          type: `audio/${fileType}`,
        } as any;

        formData.append("audio", audioFile);
      }

      console.log("[STT] Sending audio to transcription service...");
      const response = await fetch("https://toolkit.rork.com/stt/transcribe/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[STT] Transcription failed:', response.status, errorText.substring(0, 200));
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      let transcription: { text: string; language: string };
      
      if (contentType && contentType.includes('application/json')) {
        try {
          transcription = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[STT] JSON parse error:', parseError);
          console.error('[STT] Response preview:', responseText.substring(0, 200));
          throw new Error('Invalid response format from transcription service');
        }
      } else {
        console.error('[STT] Non-JSON response:', responseText.substring(0, 200));
        throw new Error('Transcription service returned non-JSON response');
      }
      
      console.log("[STT] Transcription result:", transcription);

      if (transcription.text) {
        setInput((prev) =>
          prev ? `${prev} ${transcription.text}` : transcription.text,
        );
      }
    } catch (error) {
      console.error("[STT] Transcription error:", error);
      Alert.alert("Error", "Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  }, [
    requestPermission,
    isWebSupported,
    isRecording,
    startRecording,
    stopRecording,
  ]);

  const speakMessage = useCallback(
    async (messageId: string, content: string) => {
      if (isSpeaking && speakingMessageId === messageId) {
        Speech.stop();
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        return;
      }

      if (isSpeaking) {
        Speech.stop();
      }

      setIsSpeaking(true);
      setSpeakingMessageId(messageId);

      try {
        await Speech.speak(content, {
          language: "en-US",
          pitch: 1.0,
          rate: 0.9,
          onDone: () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          },
          onStopped: () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          },
          onError: () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
          },
        });
      } catch (error) {
        console.error("TTS error:", error);
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        Alert.alert("Error", "Failed to speak message");
      }
    },
    [isSpeaking, speakingMessageId],
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isIntrospection = item.metadata?.introspection === true;
    const isCurrentlySpeaking = isSpeaking && speakingMessageId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isIntrospection && styles.introspectionBubble,
        ]}
        onLongPress={() => copyMessage(item.content)}
        activeOpacity={0.7}
      >
        {isIntrospection && (
          <View style={styles.introspectionHeader}>
            <Brain size={14} color="#8b5cf6" />
            <Text style={styles.introspectionLabel}>INTROSPECTION</Text>
          </View>
        )}
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
            isIntrospection && styles.introspectionText,
          ]}
        >
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {format(item.timestamp, "HH:mm")}
          </Text>
          {!isUser && item.source === "cached" && (
            <View style={styles.sourceBadgeCached}>
              <Text style={styles.sourceText}>cached</Text>
            </View>
          )}
          {!isUser && item.confidence && (
            <Text style={styles.confidence}>
              {(item.confidence * 100).toFixed(0)}%
            </Text>
          )}
          <View style={styles.footerSpacer} />
          {!isUser && (
            <TouchableOpacity
              style={[
                styles.speakButton,
                isCurrentlySpeaking && styles.speakButtonActive,
              ]}
              onPress={() => speakMessage(item.id, item.content)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isCurrentlySpeaking ? (
                <StopCircle size={16} color="#f59e0b" />
              ) : (
                <Volume2 size={16} color="#94a3b8" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyMessage(item.content)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ClipboardIcon size={16} color={isUser ? "#fff" : "#94a3b8"} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "monGARS",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {streamingText.length > 0 && (
          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
              styles.streamingBubble,
            ]}
          >
            <Text style={[styles.messageText, styles.assistantText]}>
              {streamingText}
            </Text>
            <ActivityIndicator
              size="small"
              color="#64748b"
              style={styles.streamingIndicator}
            />
          </View>
        )}

        {isTranscribing && (
          <View style={styles.transcribingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.transcribingText}>Transcribing...</Text>
          </View>
        )}

        {!hasLoadedModel && (
          <View style={styles.noModelBanner}>
            <Brain size={18} color="#f59e0b" />
            <Text style={styles.noModelText}>
              No local model loaded. Go to Models tab to download and load a model.
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.pasteButton}
            onPress={pasteToInput}
            disabled={cognition.isGenerating}
          >
            <ClipboardIcon
              size={20}
              color={cognition.isGenerating ? "#334155" : "#64748b"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={handleVoiceInput}
            disabled={cognition.isGenerating || isTranscribing}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Mic
                size={20}
                color={
                  isRecording
                    ? "#ef4444"
                    : cognition.isGenerating
                      ? "#334155"
                      : "#64748b"
                }
              />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={hasLoadedModel ? "Ask monGARS anything..." : "Load a model first..."}
            placeholderTextColor="#64748b"
            multiline
            maxLength={500}
            editable={!cognition.isGenerating && hasLoadedModel}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (cognition.isGenerating || !hasLoadedModel) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={cognition.isGenerating || !input.trim() || !hasLoadedModel}
          >
            {cognition.isGenerating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#3b82f6",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
  },
  streamingBubble: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "#e2e8f0",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  timestamp: {
    fontSize: 11,
    color: "#64748b",
  },
  sourceBadgeCached: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#3b82f633",
  },
  sourceText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
  },
  confidence: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "500" as const,
  },
  footerSpacer: {
    flex: 1,
  },
  copyButton: {
    padding: 6,
    backgroundColor: "#00000033",
    borderRadius: 6,
  },
  speakButton: {
    padding: 6,
    backgroundColor: "#00000033",
    borderRadius: 6,
  },
  speakButtonActive: {
    backgroundColor: "#f59e0b33",
  },
  streamingIndicator: {
    marginTop: 8,
  },

  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 8,
    alignItems: "flex-end",
  },
  pasteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: "#7f1d1d",
  },
  input: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#e2e8f0",
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#334155",
  },
  introspectionBubble: {
    backgroundColor: "#1e1b4b",
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  introspectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#8b5cf633",
  },
  introspectionLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#8b5cf6",
    textTransform: "uppercase" as const,
  },
  introspectionText: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  transcribingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    gap: 8,
  },
  transcribingText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  noModelBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#78350f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    gap: 10,
  },
  noModelText: {
    flex: 1,
    fontSize: 13,
    color: "#fef3c7",
    lineHeight: 18,
  },
});
