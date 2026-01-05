import createContextHook from "@nkzw/create-context-hook";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  city?: string;
  region?: string;
  country?: string;
  timestamp: number;
}

interface LocationContextValue {
  currentLocation: LocationData | null;
  permissionStatus: "unknown" | "granted" | "denied" | "unavailable";
  loading: boolean;
  error: string | null;
  locationSharingAllowed: boolean;
  setLocationSharingAllowed: (allowed: boolean) => void;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  locationTool: AgentTool<
    { includeAddress?: boolean },
    { location: LocationData | null; error?: string }
  >;
}

export const [LocationProvider, useLocation] = createContextHook<LocationContextValue>(() => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationSharingAllowed, setLocationSharingAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setPermissionStatus("unavailable");
        return;
      }

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(status === Location.PermissionStatus.GRANTED ? "granted" : "denied");
      } catch (err) {
        console.error("[Location] Failed to check permissions", err);
        setPermissionStatus("unavailable");
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermissionStatus("unavailable");
      setError("Location services are not available on web");
      return false;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === Location.PermissionStatus.GRANTED;
      setPermissionStatus(granted ? "granted" : "denied");
      if (granted) setError(null);
      return granted;
    } catch (err) {
      console.error("[Location] Failed to request permission", err);
      setPermissionStatus("denied");
      setError("Unable to request location permission");
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (Platform.OS === "web") {
      setError("Location services are not available on web");
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
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let city: string | undefined;
      let region: string | undefined;
      let country: string | undefined;

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (address) {
          city = address.city || undefined;
          region = address.region || undefined;
          country = address.country || undefined;
        }
      } catch (geocodeErr) {
        console.warn("[Location] Reverse geocoding failed", geocodeErr);
      }

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        city,
        region,
        country,
        timestamp: position.timestamp,
      };

      setCurrentLocation(locationData);
      return locationData;
    } catch (err) {
      console.error("[Location] Failed to get current location", err);
      setError("Failed to get current location. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [permissionStatus, requestPermission]);

  const locationTool: LocationContextValue["locationTool"] = {
    name: "get_location",
    description: "Gets the device's current GPS location (latitude, longitude) and optionally reverse geocoded address when location sharing is enabled",
    parameters: {
      type: "object",
      properties: {
        includeAddress: {
          type: "boolean",
          description: "Whether to include reverse geocoded address (city, region, country)",
        },
      },
      required: [],
    },
    execute: async ({ includeAddress = true }) => {
      if (Platform.OS === "web") {
        return { location: null, error: "Location services are not available on web" };
      }

      if (!locationSharingAllowed) {
        return {
          location: null,
          error: "Location sharing with the AI model is disabled by the user",
        };
      }

      const granted = permissionStatus === "granted" || await requestPermission();
      if (!granted) {
        return { location: null, error: "Location permission not granted" };
      }

      try {
        const location = await getCurrentLocation();
        
        if (!location) {
          return { location: null, error: "Failed to retrieve location" };
        }

        if (!includeAddress) {
          const { city, region, country, ...basicLocation } = location;
          return { location: basicLocation as LocationData };
        }

        return { location };
      } catch (err) {
        return { location: null, error: err instanceof Error ? err.message : "Failed to get location" };
      }
    },
  };

  return {
    currentLocation,
    permissionStatus,
    loading,
    error,
    locationSharingAllowed,
    setLocationSharingAllowed,
    requestPermission,
    getCurrentLocation,
    locationTool,
  };
});
