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
import { AuthProvider } from "@/lib/providers/auth";
import { ContactsProvider } from "@/lib/providers/contacts";
import { CalendarProvider } from "@/lib/providers/calendar";
import { LocationProvider } from "@/lib/providers/location";
import { CameraProvider } from "@/lib/providers/camera";
import { WebScraperProvider } from "@/lib/providers/web-scraper";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
        <AuthProvider>
          <ContactsProvider>
            <CalendarProvider>
              <LocationProvider>
                <CameraProvider>
                  <InstrumentationProvider>
              <TelemetryProvider>
                <ModelManagerProvider>
                  <UnifiedLLMProvider>
                    <HippocampusProvider>
                      <PersonalityProvider>
                        <EvolutionProvider>
                          <SelfModelProvider>
                            <IntrospectionAPIProvider
                              sessionId="main"
                              startTime={Date.now()}
                            >
                              <SommeilProvider>
                                <WebScraperProvider>
                                  <CognitionProvider>
                                    <RootLayoutNav />
                                  </CognitionProvider>
                                </WebScraperProvider>
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
                </CameraProvider>
              </LocationProvider>
            </CalendarProvider>
          </ContactsProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
