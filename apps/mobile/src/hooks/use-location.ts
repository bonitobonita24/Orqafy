import { useState, useCallback } from "react";
import {
  type GpsCoordinates,
  requestLocationPermission,
  getCurrentPosition,
} from "@/lib/gps";

interface UseLocationReturn {
  coordinates: GpsCoordinates | null;
  isLoading: boolean;
  error: string | null;
  fetchLocation: () => Promise<GpsCoordinates | null>;
}

export function useLocation(): UseLocationReturn {
  const [coordinates, setCoordinates] = useState<GpsCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setError("Location permission denied");
        setIsLoading(false);
        return null;
      }
      const position = await getCurrentPosition();
      setCoordinates(position);
      setIsLoading(false);
      return position;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get location";
      setError(message);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { coordinates, isLoading, error, fetchLocation };
}
