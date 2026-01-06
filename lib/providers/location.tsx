import createContextHook from "@nkzw/create-context-hook";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AgentTool } from "@/types";

interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

interface LocationAddress {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  street?: string | null;
  name?: string | null;
  formattedAddress?: string;
}

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | undefined>(undefined);
  const [currentAddress, setCurrentAddress] = useState<LocationAddress | undefined>(undefined);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "unavailable">("unknown");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [locationSharingAllowed, setLocationSharingAllowed] = useState<boolean>(false);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      try {
        if ("geolocation" in navigator) {
          setPermissionStatus("granted");
          return true;
        } else {
          console.log("[Location] Geolocation not supported on this browser");
          setPermissionStatus("unavailable");
          return false;
        }
      } catch (err) {
        console.error("[Location] Web geolocation check failed:", err);
        setPermissionStatus("unavailable");
        return false;
      }
    }

    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === "granted") {
        setPermissionStatus("granted");
        return true;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === "granted") {
        setPermissionStatus("granted");
        return true;
      } else {
        setPermissionStatus("denied");
        return false;
      }
    } catch (err) {
      console.error("[Location] Permission request failed:", err);
      setError((err as Error).message);
      setPermissionStatus("denied");
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | undefined> => {
    if (permissionStatus !== "granted") {
      console.log("[Location] Cannot get location: permission not granted");
      return undefined;
    }

    setLoading(true);
    setError(null);

    try {
      if (Platform.OS === "web" && "geolocation" in navigator) {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp,
              };
              setCurrentLocation(locationData);
              setLoading(false);
              resolve(locationData);
            },
            (err) => {
              console.error("[Location] Web geolocation failed:", err);
              setError(err.message);
              setLoading(false);
              reject(err);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        });
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };

      setCurrentLocation(locationData);
      console.log(`[Location] Got current location: ${locationData.latitude}, ${locationData.longitude}`);
      
      return locationData;
    } catch (err) {
      console.error("[Location] Failed to get current location:", err);
      setError((err as Error).message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [permissionStatus]);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<LocationAddress | undefined> => {
      if (Platform.OS === "web") {
        console.log("[Location] Reverse geocoding not available on web");
        return undefined;
      }

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (addresses.length > 0) {
          const address = addresses[0];
          const locationAddress: LocationAddress = {
            city: address.city,
            region: address.region,
            country: address.country,
            postalCode: address.postalCode,
            street: address.street,
            name: address.name,
            formattedAddress: [
              address.street,
              address.city,
              address.region,
              address.postalCode,
              address.country,
            ]
              .filter(Boolean)
              .join(", "),
          };

          setCurrentAddress(locationAddress);
          console.log(`[Location] Reverse geocoded to: ${locationAddress.formattedAddress}`);
          
          return locationAddress;
        }

        return undefined;
      } catch (err) {
        console.error("[Location] Reverse geocoding failed:", err);
        return undefined;
      }
    },
    []
  );

  const getCurrentLocationWithAddress = useCallback(async (): Promise<{
    location?: LocationData;
    address?: LocationAddress;
  }> => {
    const location = await getCurrentLocation();
    
    if (location && Platform.OS !== "web") {
      const address = await reverseGeocode(location.latitude, location.longitude);
      return { location, address };
    }
    
    return { location };
  }, [getCurrentLocation, reverseGeocode]);

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === "web") {
        if ("geolocation" in navigator) {
          setPermissionStatus("granted");
        } else {
          setPermissionStatus("unavailable");
        }
        return;
      }

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        
        if (status === "granted") {
          setPermissionStatus("granted");
        } else {
          setPermissionStatus(status === "denied" ? "denied" : "unknown");
        }
      } catch (err) {
        console.error("[Location] Failed to check permission:", err);
        setPermissionStatus("unknown");
      }
    };

    checkPermission();
  }, []);

  const locationTool: AgentTool<
    { includeAddress?: boolean },
    { 
      location?: LocationData; 
      address?: LocationAddress;
      error?: string;
    }
  > = {
    name: "get_location",
    description: "Gets the device's current GPS location including coordinates (latitude, longitude) and optionally reverse geocodes to a human-readable address. Only works when location sharing is enabled.",
    parameters: {
      includeAddress: {
        type: "boolean",
        description: "Whether to include reverse geocoded address (city, region, country). Note: Not available on web platform.",
        required: false,
      },
    },
    execute: async (params) => {
      if (!locationSharingAllowed) {
        return {
          error: "Location sharing is not enabled. Please enable it in settings.",
        };
      }

      if (permissionStatus !== "granted") {
        return {
          error: "Location permission not granted. Please grant permission to access location.",
        };
      }

      try {
        if (params.includeAddress && Platform.OS !== "web") {
          const result = await getCurrentLocationWithAddress();
          return result;
        } else {
          const location = await getCurrentLocation();
          return { location };
        }
      } catch (err) {
        return {
          error: `Failed to get location: ${(err as Error).message}`,
        };
      }
    },
  };

  return {
    currentLocation,
    currentAddress,
    permissionStatus,
    loading,
    error,
    locationSharingAllowed,
    setLocationSharingAllowed,
    requestPermission,
    getCurrentLocation,
    reverseGeocode,
    getCurrentLocationWithAddress,
    locationTool,
  };
});
