import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Orqafy",
  slug: "orqafy-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "orqafy",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#050507",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.powerbyte.orqafy",
    infoPlist: {
      NSCameraUsageDescription:
        "Orqafy needs camera access for receipt photos, barcode scanning, and task attachments.",
      NSLocationWhenInUseUsageDescription:
        "Orqafy needs location access to record GPS coordinates for attendance clock-in/out.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Orqafy needs background location access for accurate DTR clock-in while offline.",
      NSFaceIDUsageDescription:
        "Orqafy uses Face ID for optional app unlock.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#050507",
    },
    package: "app.powerbyte.orqafy",
    permissions: [
      "CAMERA",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "VIBRATE",
      "RECEIVE_BOOT_COMPLETED",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow Orqafy to use your location for DTR clock-in/out.",
        locationWhenInUsePermission:
          "Allow Orqafy to use your location for DTR clock-in/out.",
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow Orqafy to access your camera for receipt photos and barcode scanning.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#00d992",
      },
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Allow Orqafy to use Face ID for optional app unlock.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "your-eas-project-id",
    },
  },
});
