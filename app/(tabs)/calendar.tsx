import { Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar as CalendarIcon, RefreshCw } from "lucide-react-native";
import { useCalendar } from "@/lib/providers/calendar";

export default function CalendarScreen() {
  const {
    events,
    permissionStatus,
    loading,
    error,
    calendarSharingAllowed,
    setCalendarSharingAllowed,
    requestPermission,
    refreshEvents,
  } = useCalendar();

  const [dateRange] = useState({
    start: new Date(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  useEffect(() => {
    if (permissionStatus === "granted" && events.length === 0 && !loading) {
      refreshEvents(dateRange.start, dateRange.end);
    }
  }, [events.length, loading, permissionStatus, refreshEvents, dateRange.start, dateRange.end]);

  const handleLoad = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        "Enable calendar access so the assistant can view your schedule.",
      );
      return;
    }
    await refreshEvents(dateRange.start, dateRange.end);
  }, [refreshEvents, requestPermission, dateRange]);

  const handleRefresh = useCallback(async () => {
    await refreshEvents(dateRange.start, dateRange.end);
  }, [refreshEvents, dateRange]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.header}>Calendar Access</Text>
        <Text style={styles.subtitle}>
          Calendar is not available when running in the browser.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Calendar (Private)",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.introCard}>
        <View style={styles.introHeader}>
          <CalendarIcon size={18} color="#60a5fa" />
          <Text style={styles.introTitle}>On-device calendar</Text>
        </View>
        <Text style={styles.introText}>
          Grant access to let the assistant view your schedule. When you enable
          calendar-sharing below and ask about events, those details are sent to
          the AI model provider; nothing is uploaded otherwise.
        </Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Share events with AI model</Text>
            <Text style={styles.toggleDescription}>
              Required for the assistant to answer questions about your
              calendar. You can switch this off anytime.
            </Text>
          </View>
          <Switch
            value={calendarSharingAllowed}
            onValueChange={setCalendarSharingAllowed}
            trackColor={{ false: "#475569", true: "#3b82f6" }}
            thumbColor="#e2e8f0"
          />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleLoad}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Request & Load</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} color="#60a5fa" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>Permission: {permissionStatus}</Text>
      <Text style={styles.statusText}>
        Showing events: Next 30 days ({events.length} events)
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && (
        <ActivityIndicator style={{ marginVertical: 12 }} color="#60a5fa" />
      )}

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const startDate = new Date(item.startDate);
          const endDate = new Date(item.endDate);
          const dateStr = startDate.toLocaleDateString();
          const timeStr = item.allDay
            ? "All day"
            : `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

          return (
            <View style={styles.eventRow}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventMeta}>
                {dateStr} • {timeStr}
              </Text>
              {item.location ? (
                <Text style={styles.eventLocation}>📍 {item.location}</Text>
              ) : null}
              {item.notes ? (
                <Text style={styles.eventNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No events found</Text>
              <Text style={styles.emptyText}>
                Grant access and load your calendar to enable schedule-aware AI
                actions.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
  },
  webContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: 24,
  },
  header: {
    fontSize: 22,
    color: "#e2e8f0",
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
  },
  introCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  introTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 16,
  },
  introText: {
    color: "#94a3b8",
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  toggleTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
  },
  toggleDescription: {
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 18,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderColor: "#334155",
    borderWidth: 1,
    backgroundColor: "#111827",
  },
  refreshText: {
    color: "#60a5fa",
    fontWeight: "600",
  },
  statusText: {
    marginTop: 10,
    color: "#cbd5e1",
  },
  errorText: {
    color: "#f87171",
    marginTop: 6,
  },
  eventRow: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  eventTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 16,
  },
  eventMeta: {
    color: "#94a3b8",
    marginTop: 4,
  },
  eventLocation: {
    color: "#60a5fa",
    marginTop: 4,
  },
  eventNotes: {
    color: "#94a3b8",
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyText: {
    color: "#94a3b8",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
});
