import { useEffect, useState } from "react";
import { UserLocation } from "../types";

export function useLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  // Check for location on mount
  useEffect(() => {
    if (userLocation) return;

    // Try to get location silently first
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Show prompt if location not available
        setShowLocationPrompt(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [userLocation]);

  return {
    userLocation,
    setUserLocation,
    showLocationPrompt,
    setShowLocationPrompt,
  };
}
