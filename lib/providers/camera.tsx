import createContextHook from "@nkzw/create-context-hook";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface CameraImage {
  uri: string;
  width: number;
  height: number;
  type?: string;
  base64?: string;
}

export const [CameraProvider, useCamera] = createContextHook(() => {
  const [selectedImage, setSelectedImage] = useState<CameraImage | undefined>(undefined);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [mediaLibraryPermissionStatus, setMediaLibraryPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraSharingAllowed, setCameraSharingAllowed] = useState<boolean>(false);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      console.log("[Camera] Camera access not fully supported on web");
      setCameraPermissionStatus("unavailable");
      return false;
    }

    try {
      const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();

      if (existingStatus === "granted") {
        setCameraPermissionStatus("granted");
        return true;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status === "granted") {
        setCameraPermissionStatus("granted");
        return true;
      } else {
        setCameraPermissionStatus("denied");
        return false;
      }
    } catch (err) {
      console.error("[Camera] Permission request failed:", err);
      setError((err as Error).message);
      setCameraPermissionStatus("denied");
      return false;
    }
  }, []);

  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setMediaLibraryPermissionStatus("granted");
      return true;
    }

    try {
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (existingStatus === "granted") {
        setMediaLibraryPermissionStatus("granted");
        return true;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status === "granted") {
        setMediaLibraryPermissionStatus("granted");
        return true;
      } else {
        setMediaLibraryPermissionStatus("denied");
        return false;
      }
    } catch (err) {
      console.error("[Camera] Media library permission request failed:", err);
      setError((err as Error).message);
      setMediaLibraryPermissionStatus("denied");
      return false;
    }
  }, []);

  const takePhoto = useCallback(async (): Promise<CameraImage | undefined> => {
    if (cameraPermissionStatus !== "granted") {
      console.log("[Camera] Cannot take photo: permission not granted");
      return undefined;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const image: CameraImage = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: asset.type ?? undefined,
        };
        
        setSelectedImage(image);
        console.log(`[Camera] Photo taken: ${asset.width}x${asset.height}`);
        return image;
      }

      return undefined;
    } catch (err) {
      console.error("[Camera] Failed to take photo:", err);
      setError((err as Error).message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [cameraPermissionStatus]);

  const pickImage = useCallback(async (): Promise<CameraImage | undefined> => {
    if (mediaLibraryPermissionStatus !== "granted") {
      console.log("[Camera] Cannot pick image: permission not granted");
      return undefined;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const image: CameraImage = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: asset.type ?? undefined,
        };
        
        setSelectedImage(image);
        console.log(`[Camera] Image picked: ${asset.width}x${asset.height}`);
        return image;
      }

      return undefined;
    } catch (err) {
      console.error("[Camera] Failed to pick image:", err);
      setError((err as Error).message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [mediaLibraryPermissionStatus]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS === "web") {
        setCameraPermissionStatus("unavailable");
        setMediaLibraryPermissionStatus("granted");
        return;
      }

      try {
        const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
        setCameraPermissionStatus(cameraStatus === "granted" ? "granted" : cameraStatus === "denied" ? "denied" : "unknown");

        const { status: libraryStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        setMediaLibraryPermissionStatus(libraryStatus === "granted" ? "granted" : libraryStatus === "denied" ? "denied" : "unknown");
      } catch (err) {
        console.error("[Camera] Failed to check permissions:", err);
        setCameraPermissionStatus("unknown");
        setMediaLibraryPermissionStatus("unknown");
      }
    };

    checkPermissions();
  }, []);

  const takePictureTool: AgentTool<
    { source: "camera" | "library" },
    { image?: CameraImage; error?: string }
  > = {
    name: "take_picture",
    description: "Takes a photo using the device camera or picks an image from the photo library. Returns image metadata including dimensions and URI when camera sharing is enabled.",
    parameters: {
      source: {
        type: "string",
        description: "Image source: 'camera' to take a new photo, or 'library' to pick from existing photos",
        required: true,
      },
    },
    execute: async (params) => {
      if (!cameraSharingAllowed) {
        return {
          error: "Camera sharing is not enabled. Please enable it in settings.",
        };
      }

      const isCamera = params.source === "camera";
      const permissionStatus = isCamera ? cameraPermissionStatus : mediaLibraryPermissionStatus;

      if (permissionStatus !== "granted") {
        return {
          error: `${isCamera ? "Camera" : "Media library"} permission not granted. Please grant permission to access ${isCamera ? "camera" : "photos"}.`,
        };
      }

      try {
        const image = isCamera ? await takePhoto() : await pickImage();
        
        if (image) {
          return { image };
        } else {
          return { error: "Image capture was canceled or failed" };
        }
      } catch (err) {
        return {
          error: `Failed to ${isCamera ? "take photo" : "pick image"}: ${(err as Error).message}`,
        };
      }
    },
  };

  return {
    selectedImage,
    cameraPermissionStatus,
    mediaLibraryPermissionStatus,
    loading,
    error,
    cameraSharingAllowed,
    setCameraSharingAllowed,
    requestCameraPermission,
    requestMediaLibraryPermission,
    takePhoto,
    pickImage,
    takePictureTool,
  };
});
