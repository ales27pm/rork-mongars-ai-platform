import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { InstrumentationProvider } from "@/lib/providers/instrumentation";
import { TelemetryProvider } from "@/lib/providers/telemetry";
import { HippocampusProvider } from "@/lib/providers/hippocampus";
import { PersonalityProvider } from "@/lib/providers/personality";
import { EvolutionProvider } from "@/lib/providers/evolution";
import { SelfModelProvider } from "@/lib/providers/self-model";
import { IntrospectionAPIProvider } from "@/lib/providers/introspection-api";
import { CognitionProvider } from "@/lib/providers/cognition";
import { SommeilProvider } from "@/lib/providers/sommeil";
import { UnifiedLLMProvider } from "@/lib/providers/unified-llm";
import { ModelManagerProvider } from "@/lib/providers/model-manager";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <InstrumentationProvider>
          <TelemetryProvider>
            <ModelManagerProvider>
              <UnifiedLLMProvider>
                <HippocampusProvider>
                <PersonalityProvider>
                  <EvolutionProvider>
                    <SelfModelProvider>
                      <IntrospectionAPIProvider sessionId="main" startTime={Date.now()}>
                        <SommeilProvider>
                          <CognitionProvider>
                            <RootLayoutNav />
                          </CognitionProvider>
                        </SommeilProvider>
                      </IntrospectionAPIProvider>
                    </SelfModelProvider>
                  </EvolutionProvider>
                </PersonalityProvider>
                </HippocampusProvider>
              </UnifiedLLMProvider>
            </ModelManagerProvider>
          </TelemetryProvider>
        </InstrumentationProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
