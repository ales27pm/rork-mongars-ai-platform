import { Stack } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  Switch,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Camera as CameraIcon, Image as ImageIcon } from "lucide-react-native";
import { useCamera } from "@/lib/providers/camera";

export default function CameraScreen() {
  const {
    permissionStatus,
    loading,
    error,
    cameraSharingAllowed,
    setCameraSharingAllowed,
    requestPermission,
    takePicture,
    pickImage,
  } = useCamera();

  const [capturedImage, setCapturedImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);

  const handleTakePicture = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        "Enable camera access to take photos with the assistant.",
      );
      return;
    }
    const image = await takePicture();
    if (image) {
      setCapturedImage(image);
    }
  }, [takePicture, requestPermission]);

  const handlePickImage = useCallback(async () => {
    const image = await pickImage();
    if (image) {
      if (Array.isArray(image)) {
        setCapturedImage(image[0]);
      } else {
        setCapturedImage(image);
      }
    }
  }, [pickImage]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.header}>Camera Access</Text>
        <Text style={styles.subtitle}>
          Camera is not available when running in the browser.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Camera (Private)",
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.introCard}>
        <View style={styles.introHeader}>
          <CameraIcon size={18} color="#60a5fa" />
          <Text style={styles.introTitle}>On-device camera</Text>
        </View>
        <Text style={styles.introText}>
          Grant access to let the assistant capture images. When you enable
          camera-sharing below, captured images can be processed. Note: Image
          analysis is not yet implemented.
        </Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Allow camera access for AI</Text>
            <Text style={styles.toggleDescription}>
              Required for the assistant to capture images. You can switch this
              off anytime.
            </Text>
          </View>
          <Switch
            value={cameraSharingAllowed}
            onValueChange={setCameraSharingAllowed}
            trackColor={{ false: "#475569", true: "#3b82f6" }}
            thumbColor="#e2e8f0"
          />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleTakePicture}
          disabled={loading || !cameraSharingAllowed}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <CameraIcon size={18} color="#fff" />
              <Text style={styles.buttonText}>Take Photo</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handlePickImage}
          disabled={loading || !cameraSharingAllowed}
        >
          <ImageIcon size={18} color="#60a5fa" />
          <Text style={styles.secondaryButtonText}>Pick from Library</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>Permission: {permissionStatus}</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && (
        <ActivityIndicator style={{ marginVertical: 12 }} color="#60a5fa" />
      )}

      {capturedImage ? (
        <View style={styles.imageCard}>
          <Text style={styles.cardTitle}>Captured Image</Text>
          <Image
            source={{ uri: capturedImage.uri }}
            style={styles.image}
            resizeMode="contain"
          />
          <View style={styles.imageInfo}>
            <Text style={styles.imageInfoText}>
              Size: {capturedImage.width} × {capturedImage.height}
            </Text>
          </View>
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠️ Image analysis is not yet implemented. The AI cannot currently
              describe or analyze this image.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setCapturedImage(null)}
          >
            <Text style={styles.clearButtonText}>Clear Image</Text>
          </TouchableOpacity>
        </View>
      ) : !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No image captured</Text>
          <Text style={styles.emptyText}>
            {cameraSharingAllowed
              ? "Take a photo or pick from library to capture an image."
              : "Enable camera sharing above to capture images."}
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
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderColor: "#334155",
    borderWidth: 1,
    backgroundColor: "#111827",
  },
  secondaryButtonText: {
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
  imageCard: {
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
  image: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    backgroundColor: "#111827",
  },
  imageInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#111827",
    borderRadius: 6,
  },
  imageInfoText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  warningCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#78350f",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  warningText: {
    color: "#fef3c7",
    fontSize: 12,
    lineHeight: 18,
  },
  clearButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontWeight: "700",
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
