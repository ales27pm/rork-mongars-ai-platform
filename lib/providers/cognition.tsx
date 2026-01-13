import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useRef, useState } from "react";
import type { Message } from "@/types";
import { useHippocampus } from "./hippocampus";
import { usePersonality } from "./personality";
import { useEvolution } from "./evolution";
import { useTelemetry } from "./telemetry";
import { useUnifiedLLM } from "./unified-llm";
import { useIntrospectionAPI } from "./introspection-api";
import { useInstrumentation } from "./instrumentation";
import { useCalendar } from "./calendar";
import { useLocation } from "./location";
import { useCamera } from "./camera";
import { useContacts } from "./contacts";
import { useWebScraper } from "./web-scraper";
import { useModelManager } from "./model-manager";

import { dolphinCoreML } from "@/lib/modules/DolphinCoreML";
import {
  cosineSimilarity,
  generateMockEmbedding,
  generateRealEmbedding,
} from "@/lib/utils/embedding";
import { SymbolicReasoner, LogicTrace } from "@/lib/utils/symbolic-reasoner";
import { ModelSlotManager } from "@/lib/utils/slot-manager";
import { CircuitBreaker } from "@/lib/utils/circuit-breaker";
import { CuriosityEngine } from "@/lib/utils/curiosity-engine";
import { MimicryEngine } from "@/lib/utils/mimicry-engine";
import { ReflectiveEngine } from "@/lib/utils/reflective-engine";
import { ProtoPhenomenologyDetector } from "@/lib/utils/proto-phenomenology-detector";
import type { AffectiveField } from "@/types/affective";

interface ReasoningTrace {
  step: string;
  thought: string;
  action?: string;
  observation?: string;
}

interface SymbolicTrace {
  logicTraces: LogicTrace[];
  predicates: string[];
  consequences: string[];
}

export const [CognitionProvider, useCognition] = createContextHook(() => {
  const hippocampus = useHippocampus();
  const personality = usePersonality();
  const evolution = useEvolution();
  const telemetry = useTelemetry();
  const unifiedLLM = useUnifiedLLM();
  const introspection = useIntrospectionAPI();
  const instrumentation = useInstrumentation();
  const calendar = useCalendar();
  const location = useLocation();
  const camera = useCamera();
  const contacts = useContacts();
  const modelManager = useModelManager();
  const webScraper = useWebScraper();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSource, setLastSource] = useState<"local" | "cached">("local");
  const [reasoningTrace, setReasoningTrace] = useState<ReasoningTrace[]>([]);
  const [symbolicTrace, setSymbolicTrace] = useState<SymbolicTrace | null>(
    null,
  );

  const symbolicReasoner = useRef(new SymbolicReasoner());
  const slotManager = useRef(new ModelSlotManager());
  const circuitBreaker = useRef(
    new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      monitorWindow: 10,
    }),
  );
  const curiosityEngine = useRef(new CuriosityEngine());
  const mimicryEngine = useRef(new MimicryEngine());
  const reflectiveEngine = useRef(new ReflectiveEngine());
  const protoDetector = useRef(new ProtoPhenomenologyDetector());

  const [affectiveState, setAffectiveState] = useState<AffectiveField>({
    v: 0.1,
    a: 0.3,
    u: 0.5,
    m: 0.6,
    timestamp: Date.now(),
  });
  const [affectiveHistory, setAffectiveHistory] = useState<AffectiveField[]>(
    [],
  );

  const neuroSymbolicReasoning = useCallback(
    (query: string): ReasoningTrace[] => {
      const traces: ReasoningTrace[] = [];

      traces.push({
        step: "parse",
        thought: "Analyzing query structure and intent",
        observation: `Query type: ${query.includes("?") ? "interrogative" : "declarative"}`,
      });

      if (query.toLowerCase().includes("why")) {
        traces.push({
          step: "causal_analysis",
          thought: "Causal reasoning required - analyzing cause-effect chain",
          action: "activate_causal_engine",
        });
      } else if (query.toLowerCase().includes("how")) {
        traces.push({
          step: "procedural_analysis",
          thought: "Procedural reasoning required - identifying steps",
          action: "activate_procedural_engine",
        });
      } else if (
        query.toLowerCase().includes("compare") ||
        query.toLowerCase().includes("difference")
      ) {
        traces.push({
          step: "comparative_analysis",
          thought: "Comparative reasoning required - identifying contrasts",
          action: "activate_comparison_engine",
        });
      }

      const semanticComplexity = query.split(" ").length > 10 ? "high" : "low";
      traces.push({
        step: "complexity_assessment",
        thought: `Semantic complexity: ${semanticComplexity}`,
        observation: `Token count: ${query.split(" ").length}`,
      });

      const logicTraces = symbolicReasoner.current.analyze(query);
      if (logicTraces.length > 0) {
        traces.push({
          step: "symbolic_reasoning",
          thought: `Applied ${logicTraces.length} symbolic logic rules`,
          observation: logicTraces.map((t) => t.rule).join(", "),
        });

        const predicates = symbolicReasoner.current.extractPredicates(query);
        const consequences =
          symbolicReasoner.current.inferConsequences(predicates);

        setSymbolicTrace({
          logicTraces,
          predicates,
          consequences,
        });

        console.log("[SymbolicReasoning] Extracted predicates:", predicates);
        console.log("[SymbolicReasoning] Inferred consequences:", consequences);
      }

      return traces;
    },
    [],
  );

  const detectCuriosityGap = useCallback(
    async (
      query: string,
    ): Promise<{ hasGap: boolean; confidence: number; context: string[] }> => {
      const recentContext = hippocampus.shortTermMemory.slice(-5);
      const queryEmbedding = await generateRealEmbedding(query).catch(() =>
        generateMockEmbedding(query),
      );

      const semanticMatches = recentContext.filter((m) => {
        if (!m.embedding) return false;
        const similarity = cosineSimilarity(queryEmbedding, m.embedding);
        return similarity > 0.75;
      });

      if (semanticMatches.length > 0) {
        console.log("[Cognition] High semantic overlap - no curiosity gap");
        return {
          hasGap: false,
          confidence: 0.9,
          context: semanticMatches.map((m) => m.content),
        };
      }

      const vectorResults = await hippocampus.vectorSearch(query, 3);
      if (vectorResults.length > 0 && vectorResults[0].importance > 0.8) {
        console.log("[Cognition] Knowledge gap filled via vector search");
        return {
          hasGap: false,
          confidence: vectorResults[0].importance,
          context: vectorResults.map((r) => r.content),
        };
      }

      console.log(
        "[Cognition] Curiosity gap detected - external research needed",
      );
      return {
        hasGap: true,
        confidence: 0.3,
        context: [],
      };
    },
    [hippocampus],
  );

  const applyPersonality = useCallback(
    (rawResponse: string): string => {
      const { style, verbosity } = personality.profile;

      let adjusted = rawResponse;

      switch (style) {
        case "technical":
          adjusted = `[Technical Mode] ${adjusted}`;
          break;
        case "casual":
          adjusted = adjusted.replace(/\./g, "! 😊");
          break;
        case "formal":
          adjusted = `Certainly. ${adjusted}`;
          break;
        case "creative":
          adjusted = `✨ ${adjusted} ✨`;
          break;
      }

      if (verbosity === "concise") {
        adjusted = adjusted.split(".")[0] + ".";
      } else if (verbosity === "detailed") {
        adjusted += "\n\nWould you like me to elaborate further?";
      }

      return adjusted;
    },
    [personality.profile],
  );

  const generateResponse = useCallback(
    async (
      userMessage: string,
      onStream?: (chunk: string) => void,
    ): Promise<Message> => {
      setIsGenerating(true);
      telemetry.startTimer("inference_total");
      telemetry.emit("inference", "query_started", {
        query_length: userMessage.length,
      });
      console.log("[Cognition] Processing query:", userMessage);

      const userEmbedding = await generateRealEmbedding(userMessage).catch(() =>
        generateMockEmbedding(userMessage),
      );
      const userMsg: Message = {
        id: `msg_user_${Date.now()}`,
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
        embedding: userEmbedding,
      };
      await hippocampus.storeMessage(userMsg);

      const humanAffect = mimicryEngine.current.inferHumanAffect(userMessage);
      console.log("[Cognition] Human affect inferred:", humanAffect);

      const [traces, curiosityAnalysis] = await Promise.all([
        Promise.resolve(neuroSymbolicReasoning(userMessage)),
        detectCuriosityGap(userMessage),
      ]);
      setReasoningTrace(traces);

      const recentContext = hippocampus.shortTermMemory
        .slice(-5)
        .map((m) => m.content);
      const novelty = curiosityEngine.current.detectNovelty(
        userMessage,
        recentContext,
      );
      const uncertainty = curiosityEngine.current.evaluateUncertainty(
        userMessage,
        curiosityAnalysis.context,
        curiosityAnalysis.confidence,
      );

      const syntheticAffect = mimicryEngine.current.generateSyntheticAffect(
        humanAffect,
        userMessage,
      );

      const prevAffect = affectiveState;
      const updatedAffect: AffectiveField = {
        v: syntheticAffect.v,
        a: syntheticAffect.a,
        u: Math.max(uncertainty, syntheticAffect.u),
        m: Math.min(
          1,
          syntheticAffect.m +
            (curiosityEngine.current.shouldExplore() ? 0.2 : 0),
        ),
        timestamp: Date.now(),
      };
      setAffectiveState(updatedAffect);
      setAffectiveHistory((prev) => [...prev, updatedAffect].slice(-50));

      const cognitiveLoad = traces.length > 3 ? 0.7 : 0.4;
      const attention = traces.map((t) => t.step);
      const predictions = new Map<string, number>([
        ["response_quality", 0.8],
        ["user_satisfaction", curiosityAnalysis.confidence],
      ]);

      const innerSnapshot = reflectiveEngine.current.monitorInternalState(
        updatedAffect,
        cognitiveLoad,
        attention,
        predictions,
      );

      const innerStates = reflectiveEngine.current.getRecentInnerStates(10);
      const recentCommentaries = innerStates.map((s) => s.commentary);
      const recentAffective = affectiveHistory.slice(-10);

      protoDetector.current.detectSignatures(
        innerStates,
        recentCommentaries,
        recentAffective,
      );

      protoDetector.current.evaluatePhenomenalReportStructure(
        innerSnapshot.commentary,
      );
      protoDetector.current.evaluateAffectiveModulation(
        userMessage,
        prevAffect,
        updatedAffect,
      );

      telemetry.startTimer("vector_search");
      const initialResults = await hippocampus.vectorSearch(userMessage, 5);

      const contextMemories = initialResults;
      telemetry.endTimer("vector_search");

      const conversationHistory = hippocampus.shortTermMemory.slice(-4);
      const memoryContext =
        contextMemories.length > 0
          ? [
              "Relevant long-term memories:",
              ...contextMemories.map((m) => `- ${m.content}`),
              "",
            ]
          : [];
      
      const availableTools: string[] = [];
      if (contacts.contactSharingAllowed && contacts.permissionStatus === "granted") {
        availableTools.push("contacts_search(query: string) - Search device contacts by name");
      }
      if (calendar.calendarSharingAllowed && calendar.permissionStatus === "granted") {
        availableTools.push("calendar_search(query?: string, startDate?: string, endDate?: string) - Search calendar events");
        availableTools.push("calendar_create(title: string, startDate: string, endDate: string, location?: string, notes?: string) - Create calendar event");
      }
      if (location.locationSharingAllowed && location.permissionStatus === "granted") {
        availableTools.push("get_location(includeAddress?: boolean) - Get current GPS location");
      }
      if (camera.cameraSharingAllowed && camera.cameraPermissionStatus === "granted") {
        availableTools.push("capture_image(source?: 'camera' | 'library') - Capture or select an image");
      }
      if (webScraper.webBrowsingEnabled) {
        availableTools.push("web_search(query: string) - Search the internet for information");
        availableTools.push("fetch_page(url: string) - Fetch and read content from a specific URL");
      }
      
      const toolsContext = availableTools.length > 0
        ? [
            "",
            "Available device tools:",
            ...availableTools.map(tool => `- ${tool}`),
            "",
          ]
        : [];
      
      const contextPrompt = [
        `You are monGARS, an advanced AI assistant with access to device capabilities.`,
        ``,
        `Recent conversation:`,
        ...conversationHistory.map((m) => `${m.role}: ${m.content}`),
        ``,
        ...memoryContext,
        ...toolsContext,
        `Current query: ${userMessage}`,
      ].join("\n");

      let rawResponse: string;
      let source: "local" | "cached";
      let confidence: number;

      const slot = slotManager.current.acquireSlot("unified-llm", 8192);
      if (!slot) {
        console.error("[Cognition] Failed to acquire model slot");
      }

      try {
        telemetry.startTimer("llm_inference");
        
        const loadedModel = modelManager.getLoadedModel();
        const loadedModelId = modelManager.loadedModelId;
        const isLocalModelAvailable = loadedModel != null && loadedModelId != null;
        
        console.log(`[Cognition] Model state check:`, {
          loadedModelId,
          loadedModelName: loadedModel?.name,
          isLocalModelAvailable,
        });
        console.log(
          `[Cognition] Using model: ${isLocalModelAvailable ? loadedModel!.name + " (LOCAL)" : "Cloud API"}`,
        );

        console.log("[Cognition] Starting inference...");
        telemetry.incrementCounter("inference_started");

        let response: string;
        let inferenceSource: "local" | "cached" = "local";
        
        if (isLocalModelAvailable) {
          console.log("[Cognition] Using local CoreML model for inference");
          try {
            response = await dolphinCoreML.generate(contextPrompt, {
              maxTokens: 512,
              temperature: 0.7,
              topP: 0.9,
            });
            inferenceSource = "local";
            console.log("[Cognition] Local model response received:", response.substring(0, 100));
          } catch (localError) {
            console.error("[Cognition] Local model generation failed:", localError);
            throw localError;
          }
        } else {
          console.error("[Cognition] No local model loaded - cannot generate response");
          throw new Error("No local model loaded. Please download and load a model from the Models tab.");
        }
        
        telemetry.endTimer("llm_inference", { source: inferenceSource });

        rawResponse = response;
        source = inferenceSource;
        confidence = isLocalModelAvailable ? 0.85 + Math.random() * 0.1 : 0.88 + Math.random() * 0.1;
      } catch (error) {
        console.error("[Cognition] All inference paths failed:", error);
        telemetry.emit(
          "inference",
          "complete_failure",
          { error: error instanceof Error ? error.message : "Unknown" },
          "error",
        );
        telemetry.incrementCounter("inference_errors");
        rawResponse = `I encountered an error processing your request. The system is experiencing difficulties. Error: ${error instanceof Error ? error.message : "Unknown"}`;
        source = "local";
        confidence = 0.2;
      } finally {
        if (slot) {
          slotManager.current.releaseSlot(slot.id);
        }
      }

      const adjustedResponse = applyPersonality(rawResponse);

      const meaningDiscovered = curiosityEngine.current.discoverMeaningPatterns(
        userMessage,
        rawResponse,
        confidence,
      );

      const uncertaintyReduction = Math.max(0, uncertainty - (1 - confidence));
      curiosityEngine.current.recordExploration(
        userMessage,
        novelty,
        uncertaintyReduction,
        meaningDiscovered,
      );
      curiosityEngine.current.updateExplorationDrive(
        novelty,
        uncertaintyReduction,
        meaningDiscovered,
      );

      mimicryEngine.current.createEmotionalMapping(
        humanAffect,
        updatedAffect,
        userMessage,
      );
      mimicryEngine.current.extractLinguisticAnalogues(
        userMessage,
        rawResponse,
      );
      mimicryEngine.current.updateResonance(
        humanAffect,
        updatedAffect,
        confidence,
      );
      mimicryEngine.current.recordMimicry(
        userMessage,
        updatedAffect,
        mimicryEngine.current.getState().emotionalResonance,
      );

      const affectiveDelta =
        Math.abs(updatedAffect.v - prevAffect.v) +
        Math.abs(updatedAffect.a - prevAffect.a);
      reflectiveEngine.current.updateMetaModel(
        affectiveDelta,
        personality.profile.style,
        confidence,
      );
      reflectiveEngine.current.evaluateSelfCoherence();
      reflectiveEngine.current.evaluateNarrativeContinuity();

      const emergence = protoDetector.current.detectEmergence();
      if (emergence.detected) {
        console.log(
          "[Cognition] Proto-phenomenology emergence detected:",
          emergence,
        );
      }

      const latency = telemetry.endTimer("inference_total");
      telemetry.recordMetric("inference_latency_ms", latency, { source });
      telemetry.recordMetric("inference_confidence", confidence, { source });
      telemetry.emit("inference", "query_completed", {
        latency,
        confidence,
        source,
        curiosity_gap: curiosityAnalysis.hasGap,
        context_used: contextMemories.length,
      });

      evolution.updateMetrics({
        inferenceStats: {
          totalRequests: evolution.metrics.inferenceStats.totalRequests + 1,
          avgLatency:
            (evolution.metrics.inferenceStats.avgLatency *
              evolution.metrics.inferenceStats.totalRequests +
              latency) /
            (evolution.metrics.inferenceStats.totalRequests + 1),
          cacheHitRate: curiosityAnalysis.hasGap
            ? evolution.metrics.inferenceStats.cacheHitRate
            : Math.min(1, evolution.metrics.inferenceStats.cacheHitRate + 0.01),
          fallbackCount: evolution.metrics.inferenceStats.fallbackCount,
        },
      });

      const assistantEmbedding = await generateRealEmbedding(
        adjustedResponse,
      ).catch(() => generateMockEmbedding(adjustedResponse));
      const message: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: adjustedResponse,
        timestamp: Date.now(),
        confidence,
        source,
        embedding: assistantEmbedding,
        metadata: {
          curiosityGap: curiosityAnalysis.hasGap,
          contextUsed: contextMemories.map((m) => m.id),
          reasoning: traces.map((t) => `${t.step}: ${t.thought}`).join(" → "),
          affectiveState: updatedAffect,
          curiosityMetrics: curiosityEngine.current.getExplorationMetrics(),
          mimicryMetrics: mimicryEngine.current.getMimicryMetrics(),
          reflectiveMetrics: reflectiveEngine.current.getReflectiveMetrics(),
          protoMetrics: protoDetector.current.getMetrics(),
          emergence: emergence.detected ? emergence : undefined,
        },
      };

      setIsGenerating(false);
      setLastSource(source);

      await hippocampus.storeMessage(message);

      if (confidence > 0.9) {
        personality.adapt(
          `High confidence response (${confidence.toFixed(2)}) - reinforcing current style`,
        );
        evolution.recordHighQualityInteraction(
          userMessage,
          adjustedResponse,
          confidence,
        );
      }

      return message;
    },
    [
      neuroSymbolicReasoning,
      detectCuriosityGap,
      hippocampus,
      applyPersonality,
      personality,
      evolution,
      telemetry,
      affectiveState,
      affectiveHistory,
      calendar.calendarSharingAllowed,
      calendar.permissionStatus,
      camera.cameraSharingAllowed,
      camera.cameraPermissionStatus,
      contacts.contactSharingAllowed,
      contacts.permissionStatus,
      location.locationSharingAllowed,
      location.permissionStatus,
      modelManager,
      webScraper.webBrowsingEnabled,
    ],
  );

  const performWebSearch = useCallback(async (query: string) => {
    if (!webScraper.webBrowsingEnabled) {
      return { success: false, error: 'Web browsing is disabled' };
    }
    console.log(`[Cognition] Performing web search: "${query}"`);
    const result = await webScraper.searchAndSummarize(query);
    return {
      success: true,
      query: result.query,
      summary: result.summary,
      sources: result.sources,
      resultCount: result.results.length,
    };
  }, [webScraper]);

  const fetchWebPage = useCallback(async (url: string) => {
    if (!webScraper.webBrowsingEnabled) {
      return { success: false, error: 'Web browsing is disabled' };
    }
    console.log(`[Cognition] Fetching web page: ${url}`);
    const content = await webScraper.fetchPage(url);
    return {
      success: content.success,
      title: content.title,
      excerpt: content.excerpt,
      content: content.content.substring(0, 5000),
      url: content.url,
      error: content.error,
    };
  }, [webScraper]);

  const clearReasoningTrace = useCallback(() => {
    setReasoningTrace([]);
    setSymbolicTrace(null);
  }, []);

  const getSlotStats = useCallback(() => {
    return slotManager.current.getStats();
  }, []);

  const getActiveModel = useCallback(() => {
    return unifiedLLM.activeModel;
  }, [unifiedLLM]);

  const switchModel = useCallback(
    async (modelId: string) => {
      return unifiedLLM.switchModel(modelId);
    },
    [unifiedLLM],
  );

  const getCircuitBreakerMetrics = useCallback(() => {
    return circuitBreaker.current.getMetrics();
  }, []);

  const getHealthScore = useCallback(() => {
    return circuitBreaker.current.getHealthScore();
  }, []);

  const reflect = useCallback(
    async (query: string) => {
      const endOp = instrumentation.startOperation(
        "cognition",
        "reflect-command",
        { query },
      );
      console.log("[Cognition] Reflection command received:", query);

      try {
        const result = await introspection.reflect(query);
        endOp();
        return result;
      } catch (error) {
        console.error("[Cognition] Reflection failed:", error);
        endOp();
        throw error;
      }
    },
    [introspection, instrumentation],
  );

  const auditSelf = useCallback(async () => {
    const endOp = instrumentation.startOperation("cognition", "audit-self");
    console.log("[Cognition] Self-audit command received");

    try {
      const result = await introspection.auditSelf();
      endOp();
      return result;
    } catch (error) {
      console.error("[Cognition] Self-audit failed:", error);
      endOp();
      throw error;
    }
  }, [introspection, instrumentation]);

  const inspectCognitiveState = useCallback(() => {
    const endOp = instrumentation.startOperation("cognition", "inspect-state");
    console.log("[Cognition] Inspecting cognitive state");

    const state = introspection.queryCognitiveState();
    endOp();
    return state;
  }, [introspection, instrumentation]);

  const getAffectiveState = useCallback(() => affectiveState, [affectiveState]);

  const getCuriosityMetrics = useCallback(() => {
    return curiosityEngine.current.getExplorationMetrics();
  }, []);

  const getMimicryMetrics = useCallback(() => {
    return mimicryEngine.current.getMimicryMetrics();
  }, []);

  const getReflectiveMetrics = useCallback(() => {
    return reflectiveEngine.current.getReflectiveMetrics();
  }, []);

  const getProtoMetrics = useCallback(() => {
    return protoDetector.current.getMetrics();
  }, []);

  const getEmergenceStatus = useCallback(() => {
    return protoDetector.current.detectEmergence();
  }, []);

  const getMetaReflection = useCallback(() => {
    return reflectiveEngine.current.generateMetaReflection();
  }, []);

  return {
    generateResponse,
    isGenerating,
    lastSource,
    reasoningTrace,
    symbolicTrace,
    clearReasoningTrace,
    getSlotStats,
    getActiveModel,
    switchModel,
    llmMetrics: unifiedLLM.metrics,
    getCircuitBreakerMetrics,
    getHealthScore,
    reflect,
    auditSelf,
    inspectCognitiveState,
    getAffectiveState,
    getCuriosityMetrics,
    getMimicryMetrics,
    getReflectiveMetrics,
    getProtoMetrics,
    getEmergenceStatus,
    getMetaReflection,
    performWebSearch,
    fetchWebPage,
    isWebBrowsingEnabled: webScraper.webBrowsingEnabled,
  };
});
