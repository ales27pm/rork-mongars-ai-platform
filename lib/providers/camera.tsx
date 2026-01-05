import createContextHook from "@nkzw/create-context-hook";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface CameraImage {
  uri: string;
  width: number;
  height: number;
  type: "image";
  timestamp: number;
}

interface CameraContextValue {
  permissionStatus: "unknown" | "granted" | "denied" | "unavailable";
  loading: boolean;
  error: string | null;
  cameraSharingAllowed: boolean;
  setCameraSharingAllowed: (allowed: boolean) => void;
  requestPermission: () => Promise<boolean>;
  takePicture: () => Promise<CameraImage | null>;
  pickImage: () => Promise<CameraImage | null>;
  cameraTool: AgentTool<
    { source?: "camera" | "library" },
    { image: CameraImage | null; error?: string }
  >;
}

export const [CameraProvider, useCamera] = createContextHook<CameraContextValue>(() => {
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraSharingAllowed, setCameraSharingAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setPermissionStatus("unavailable");
        return;
      }

      try {
        const { status } = await ImagePicker.getCameraPermissionsAsync();
        setPermissionStatus(status === ImagePicker.PermissionStatus.GRANTED ? "granted" : "denied");
      } catch (err) {
        console.error("[Camera] Failed to check permissions", err);
        setPermissionStatus("unavailable");
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermissionStatus("unavailable");
      setError("Camera is not available on web");
      return false;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === ImagePicker.PermissionStatus.GRANTED;
      setPermissionStatus(granted ? "granted" : "denied");
      if (granted) setError(null);
      return granted;
    } catch (err) {
      console.error("[Camera] Failed to request permission", err);
      setPermissionStatus("denied");
      setError("Unable to request camera permission");
      return false;
    }
  }, []);

  const takePicture = useCallback(async (): Promise<CameraImage | null> => {
    if (Platform.OS === "web") {
      setError("Camera is not available on web");
      return null;
    }

    setLoading(true);
    setError(null);

    const granted = permissionStatus === "granted" || await requestPermission();
    if (!granted) {
      setLoading(false);
      return null;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) {
        setLoading(false);
        return null;
      }

      const asset = result.assets[0];
      const image: CameraImage = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: "image",
        timestamp: Date.now(),
      };

      return image;
    } catch (err) {
      console.error("[Camera] Failed to take picture", err);
      setError("Failed to take picture. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [permissionStatus, requestPermission]);

  const pickImage = useCallback(async (): Promise<CameraImage | null> => {
    if (Platform.OS === "web") {
      setError("Image picker is not available on web");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        setError("Media library permission not granted");
        setLoading(false);
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) {
        setLoading(false);
        return null;
      }

      const asset = result.assets[0];
      const image: CameraImage = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: "image",
        timestamp: Date.now(),
      };

      return image;
    } catch (err) {
      console.error("[Camera] Failed to pick image", err);
      setError("Failed to pick image. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const cameraTool: CameraContextValue["cameraTool"] = {
    name: "capture_image",
    description: "Captures an image from the camera or selects from photo library when camera access is enabled. Note: Image analysis is not yet implemented.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["camera", "library"],
          description: "Source to get image from: 'camera' to take a new photo, 'library' to pick from photo library",
        },
      },
      required: [],
    },
    execute: async ({ source = "camera" }) => {
      if (Platform.OS === "web") {
        return { image: null, error: "Camera is not available on web" };
      }

      if (!cameraSharingAllowed) {
        return {
          image: null,
          error: "Camera access is disabled by the user",
        };
      }

      try {
        const image = source === "camera" ? await takePicture() : await pickImage();
        
        if (!image) {
          return { image: null, error: "No image captured" };
        }

        return { 
          image,
          error: "Image captured successfully. Note: On-device image analysis is not yet implemented. The AI cannot currently describe or analyze this image."
        };
      } catch (err) {
        return { image: null, error: err instanceof Error ? err.message : "Failed to capture image" };
      }
    },
  };

  return {
    permissionStatus,
    loading,
    error,
    cameraSharingAllowed,
    setCameraSharingAllowed,
    requestPermission,
    takePicture,
    pickImage,
    cameraTool,
  };
});
