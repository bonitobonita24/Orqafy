import * as LocalAuthentication from "expo-local-authentication";

/**
 * App-unlock gate — Face ID / fingerprint to unlock LOCAL access to an
 * already-authenticated session (index.tsx calls this only after
 * isAuthenticated() confirms a token pair is stored). This is NOT a
 * replacement for credentials login — it never issues or refreshes a token,
 * it only gates entry into (app) once a session already exists.
 *
 * Graceful degradation: a device with no biometric hardware or nothing
 * enrolled cannot be gated on biometrics — treat as unlocked rather than
 * lock the user out of a feature their device doesn't support.
 */
export async function unlockWithBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return true;
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Orqafy",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  return result.success;
}
