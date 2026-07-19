import type { ExpoConfig, ConfigContext } from "expo/config";

// Build-time env vars, set per EAS build profile (see eas.json `build.*.env`)
// or by the EAS dashboard "Environment variables" (linked via `build.*.environment`).
// Local `expo start` / `expo run:*` leave these undefined -> src/env.ts falls back
// to its own development defaults (localhost API, APP_ENV=development).
const APP_ENV = process.env.APP_ENV;
const API_URL = process.env.API_URL;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Orqafy",
  slug: "orqafy-mobile",
  // Fleet versioning standard (~/.claude/rules/versioning-standard.md): SemVer X.Y.Z,
  // pre-1.0 while a component is still in development. This is the mobile app's
  // FIRST release line -- no prior mobile build has ever shipped to EAS/stores, so
  // it starts at 0.1.0. This is independent of the root/web fleet track (0.10.0 /
  // 0.9.0) -- store app versions are per-app, not fleet-wide.
  version: "0.1.0",
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
    // Read by apps/mobile/src/env.ts via Constants.expoConfig?.extra.
    // Unset in local dev -> env.ts falls back to its own defaults.
    apiUrl: API_URL,
    appEnv: APP_ENV,
    eas: {
      // PLACEHOLDER -- replaced automatically by `eas init` (run by the owner,
      // requires an Expo account login this agent cannot perform). EAS CLI writes
      // the real project UUID back into this file on first `eas init` / `eas build`.
      // See the "Owner commands" section reported at the end of this task.
      projectId: "your-eas-project-id",
    },
  },
});
