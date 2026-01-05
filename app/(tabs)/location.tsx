import { Stack } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MapPin, RefreshCw } from "lucide-react-native";
import { useLocation } from "@/lib/providers/location";

export default function LocationScreen() {
  const {
    currentLocation,
    permissionStatus,
    loading,
    error,
    locationSharingAllowed,
    setLocationSharingAllowed,
    requestPermission,
    getCurrentLocation,
  } = useLocation();

  const handleLoad = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        "Enable location access so the assistant can use your location.",
      );
      return;
    }
    await getCurrentLocation();
  }, [getCurrentLocation, requestPermission]);

  const handleRefresh = useCallback(async () => {
    await getCurrentLocation();
  }, [getCurrentLocation]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.header}>Location Access</Text>
        <Text style={styles.subtitle}>
          Location services are not available when running in the browser.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Location (Private)",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.introCard}>
        <View style={styles.introHeader}>
          <MapPin size={18} color="#60a5fa" />
          <Text style={styles.introTitle}>On-device location</Text>
        </View>
        <Text style={styles.introText}>
          Grant access to let the assistant use your GPS location. When you
          enable location-sharing below and ask location-based questions, your
          coordinates are sent to the AI model provider; nothing is uploaded
          otherwise.
        </Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Share location with AI model</Text>
            <Text style={styles.toggleDescription}>
              Required for the assistant to answer location-based questions. You
              can switch this off anytime.
            </Text>
          </View>
          <Switch
            value={locationSharingAllowed}
            onValueChange={setLocationSharingAllowed}
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
            <Text style={styles.buttonText}>Request & Get Location</Text>
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && (
        <ActivityIndicator style={{ marginVertical: 12 }} color="#60a5fa" />
      )}

      {currentLocation ? (
        <View style={styles.locationCard}>
          <Text style={styles.cardTitle}>Current Location</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Latitude:</Text>
            <Text style={styles.locationValue}>
              {currentLocation.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Longitude:</Text>
            <Text style={styles.locationValue}>
              {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>
          {currentLocation.altitude !== null && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Altitude:</Text>
              <Text style={styles.locationValue}>
                {currentLocation.altitude.toFixed(2)}m
              </Text>
            </View>
          )}
          {currentLocation.accuracy !== null && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Accuracy:</Text>
              <Text style={styles.locationValue}>
                ±{currentLocation.accuracy.toFixed(2)}m
              </Text>
            </View>
          )}
          {currentLocation.city && (
            <View style={styles.addressCard}>
              <Text style={styles.addressTitle}>Address</Text>
              <Text style={styles.addressText}>
                {currentLocation.city}
                {currentLocation.region ? `, ${currentLocation.region}` : ""}
                {currentLocation.country ? `, ${currentLocation.country}` : ""}
              </Text>
            </View>
          )}
          <Text style={styles.timestamp}>
            Updated: {new Date(currentLocation.timestamp).toLocaleString()}
          </Text>
        </View>
      ) : !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No location data</Text>
          <Text style={styles.emptyText}>
            Grant access and get your current location to enable location-aware
            AI actions.
          </Text>
        </View>
      ) : null}
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
  locationCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  locationLabel: {
    color: "#94a3b8",
    fontSize: 14,
  },
  locationValue: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 14,
  },
  addressCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#111827",
    borderRadius: 8,
  },
  addressTitle: {
    color: "#60a5fa",
    fontWeight: "700",
    marginBottom: 4,
  },
  addressText: {
    color: "#e2e8f0",
  },
  timestamp: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    marginTop: 24,
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
