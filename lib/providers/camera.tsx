import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  fileSize?: number;
  base64?: string | null;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any) => Promise<any>;
}

export const [CameraProvider, useCamera] = createContextHook(() => {
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<'undetermined' | 'denied' | 'granted'>('undetermined');
  const [mediaPermissionStatus, setMediaPermissionStatus] = useState<'undetermined' | 'denied' | 'granted'>('undetermined');
  const [isLoading, setIsLoading] = useState(false);
  const [lastImage, setLastImage] = useState<ImageResult | null>(null);
  const [cameraSharingAllowed, setCameraSharingAllowed] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[CameraProvider] Camera not fully supported on web');
      return false;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasCameraPermission(granted);
      setCameraPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.error('[CameraProvider] Error requesting camera permission:', error);
      setCameraPermissionStatus('denied');
      return false;
    }
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[CameraProvider] Media library not fully supported on web');
      return false;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = status === 'granted';
      setHasMediaLibraryPermission(granted);
      setMediaPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.error('[CameraProvider] Error requesting media library permission:', error);
      setMediaPermissionStatus('denied');
      return false;
    }
  };

  const takePicture = useCallback(async (options?: {
    allowsEditing?: boolean;
    quality?: number;
    includeBase64?: boolean;
  }): Promise<ImageResult | null> => {
    if (Platform.OS === 'web') {
      console.warn('[CameraProvider] Camera not available on web');
      return null;
    }

    const granted = hasCameraPermission || await requestCameraPermission();
    if (!granted) {
      console.warn('[CameraProvider] Camera permission not granted');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? false,
        quality: options?.quality ?? 0.8,
        base64: options?.includeBase64 ?? false,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      const imageResult: ImageResult = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image',
        fileSize: asset.fileSize,
        base64: asset.base64 ?? null
      };

      setLastImage(imageResult);
      return imageResult;
    } catch (error) {
      console.error('[CameraProvider] Error taking picture:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasCameraPermission]);

  const pickImage = useCallback(async (options?: {
    allowsEditing?: boolean;
    quality?: number;
    includeBase64?: boolean;
    allowsMultipleSelection?: boolean;
  }): Promise<ImageResult | ImageResult[] | null> => {
    if (Platform.OS === 'web') {
      console.warn('[CameraProvider] Image picker limited on web');
    }

    const granted = hasMediaLibraryPermission || await requestMediaLibraryPermission();
    if (!granted && Platform.OS !== 'web') {
      console.warn('[CameraProvider] Media library permission not granted');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? false,
        quality: options?.quality ?? 0.8,
        base64: options?.includeBase64 ?? false,
        allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
      });

      if (result.canceled) {
        return null;
      }

      if (options?.allowsMultipleSelection) {
        return result.assets.map(asset => ({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: 'image' as const,
          fileSize: asset.fileSize,
          base64: asset.base64 ?? null
        }));
      }

      const asset = result.assets[0];
      const imageResult: ImageResult = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: 'image',
        fileSize: asset.fileSize,
        base64: asset.base64 ?? null
      };

      setLastImage(imageResult);
      return imageResult;
    } catch (error) {
      console.error('[CameraProvider] Error picking image:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasMediaLibraryPermission]);

  const cameraCaptureTool: AgentTool = {
    name: 'camera_capture',
    description: 'Captures a photo using the device camera. Use this when the user asks to take a picture or capture an image. Returns the image URI and metadata when camera sharing is enabled.',
    parameters: {
      type: 'object',
      properties: {
        allowsEditing: {
          type: 'boolean',
          description: 'Whether to allow the user to edit the photo after capture'
        },
        quality: {
          type: 'number',
          description: 'Image quality from 0 to 1 (default: 0.8)'
        }
      },
      required: []
    },
    execute: async (params: { allowsEditing?: boolean; quality?: number }) => {
      console.log('[CameraTool] Executing camera_capture with params:', params);

      if (!cameraSharingAllowed) {
        return {
          error: 'Camera access not enabled',
          message: 'User has not granted camera sharing permission to AI'
        };
      }

      if (cameraPermissionStatus !== 'granted') {
        const granted = await requestCameraPermission();
        if (!granted) {
          return {
            error: 'Permission denied',
            message: 'Camera permission not granted by system'
          };
        }
      }

      setIsLoading(true);
      try {
        const image = await takePicture({
          allowsEditing: params.allowsEditing,
          quality: params.quality,
          includeBase64: false
        });

        if (!image) {
          return {
            error: 'Capture cancelled',
            message: 'User cancelled photo capture or an error occurred'
          };
        }

        return {
          success: true,
          image: {
            uri: image.uri,
            width: image.width,
            height: image.height,
            fileSize: image.fileSize
          },
          message: 'Photo captured successfully'
        };
      } catch (error) {
        return {
          error: 'Capture failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        setIsLoading(false);
      }
    }
  };

  const imagePickerTool: AgentTool = {
    name: 'image_picker',
    description: 'Lets the user select an image from their photo library. Use this when the user wants to choose an existing photo. Returns the image URI and metadata when media library access is enabled.',
    parameters: {
      type: 'object',
      properties: {
        allowsEditing: {
          type: 'boolean',
          description: 'Whether to allow the user to edit the selected image'
        },
        quality: {
          type: 'number',
          description: 'Image quality from 0 to 1 (default: 0.8)'
        }
      },
      required: []
    },
    execute: async (params: { allowsEditing?: boolean; quality?: number }) => {
      console.log('[CameraTool] Executing image_picker with params:', params);

      if (!cameraSharingAllowed) {
        return {
          error: 'Media library access not enabled',
          message: 'User has not granted media library sharing permission to AI'
        };
      }

      if (mediaPermissionStatus !== 'granted') {
        const granted = await requestMediaLibraryPermission();
        if (!granted) {
          return {
            error: 'Permission denied',
            message: 'Media library permission not granted by system'
          };
        }
      }

      setIsLoading(true);
      try {
        const image = await pickImage({
          allowsEditing: params.allowsEditing,
          quality: params.quality,
          includeBase64: false
        });

        if (!image || Array.isArray(image)) {
          return {
            error: 'Selection cancelled',
            message: 'User cancelled image selection or an error occurred'
          };
        }

        return {
          success: true,
          image: {
            uri: image.uri,
            width: image.width,
            height: image.height,
            fileSize: image.fileSize
          },
          message: 'Image selected successfully'
        };
      } catch (error) {
        return {
          error: 'Selection failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    hasCameraPermission,
    hasMediaLibraryPermission,
    cameraPermissionStatus,
    mediaPermissionStatus,
    permissionStatus: cameraPermissionStatus,
    isLoading,
    loading: isLoading,
    lastImage,
    error: null as string | null,
    cameraSharingAllowed,
    setCameraSharingAllowed,
    requestCameraPermission,
    requestMediaLibraryPermission,
    requestPermission: requestCameraPermission,
    takePicture,
    pickImage,
    cameraCaptureTool,
    imagePickerTool
  };
});
