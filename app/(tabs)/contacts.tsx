import { Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BookUser, RefreshCw } from "lucide-react-native";
import { useContacts } from "@/lib/providers/contacts";

export default function ContactsScreen() {
  const {
    contacts,
    permissionStatus,
    loading,
    error,
    requestPermission,
    refreshContacts,
    findContactByName,
  } = useContacts();

  const [query, setQuery] = useState("");

  const visibleContacts = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed) {
      return findContactByName(trimmed, 20);
    }
    return contacts.slice(0, 50);
  }, [contacts, findContactByName, query]);

  useEffect(() => {
    if (permissionStatus === "granted" && contacts.length === 0 && !loading) {
      refreshContacts();
    }
  }, [contacts.length, loading, permissionStatus, refreshContacts]);

  const handleLoad = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        "Enable contacts access so the assistant can search your address book on-device.",
      );
      return;
    }
    await refreshContacts();
  }, [refreshContacts, requestPermission]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.header}>Contacts Access</Text>
        <Text style={styles.subtitle}>
          Contacts are not available when running in the browser.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Contacts (Private)",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.introCard}>
        <View style={styles.introHeader}>
          <BookUser size={18} color="#60a5fa" />
          <Text style={styles.introTitle}>On-device address book</Text>
        </View>
        <Text style={styles.introText}>
          Contacts stay on your device. Grant access to let the assistant find
          names without uploading them.
        </Text>
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
          onPress={refreshContacts}
          disabled={loading}
        >
          <RefreshCw size={16} color="#60a5fa" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>Permission: {permissionStatus}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        placeholder="Search by name (e.g., John)"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        autoCapitalize="words"
      />

      {loading && (
        <ActivityIndicator style={{ marginVertical: 12 }} color="#60a5fa" />
      )}

      <FlatList
        data={visibleContacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const primaryPhone = item.phoneNumbers[0];
          const primaryEmail = item.emails[0];
          return (
            <View style={styles.contactRow}>
              <Text style={styles.contactName}>{item.name}</Text>
              {primaryPhone ? (
                <Text style={styles.contactMeta}>{primaryPhone}</Text>
              ) : null}
              {!primaryPhone && primaryEmail ? (
                <Text style={styles.contactMeta}>{primaryEmail}</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No contacts found</Text>
              <Text style={styles.emptyText}>
                Grant access and load your address book to enable contact-aware
                AI actions.
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
  search: {
    marginTop: 12,
    backgroundColor: "#111827",
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  contactRow: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  contactName: {
    color: "#e2e8f0",
    fontWeight: "700",
    fontSize: 16,
  },
  contactMeta: {
    color: "#94a3b8",
    marginTop: 4,
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
