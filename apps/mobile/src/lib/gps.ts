import * as Location from "expo-location";

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestBackgroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPosition(): Promise<GpsCoordinates> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}
