import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { router } from "expo-router";

interface NotificationData {
  screen?: string;
  id?: string;
  [key: string]: unknown;
}

export function setupNotificationListeners(): () => void {
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      handleDeepLink(data);
    });

  const linkSubscription = Linking.addEventListener("url", (event) => {
    handleUrlDeepLink(event.url);
  });

  return () => {
    responseSubscription.remove();
    linkSubscription.remove();
  };
}

function handleDeepLink(data: NotificationData): void {
  if (data.screen === undefined) return;

  switch (data.screen) {
    case "dtr":
      router.push("/(app)/dtr/");
      break;
    case "task":
      if (data.id !== undefined) {
        router.push(`/(app)/tasks/${data.id}`);
      }
      break;
    case "expense":
      router.push("/(app)/expenses/");
      break;
    case "payslip":
      router.push("/(app)/payslips/");
      break;
    default:
      break;
  }
}

function handleUrlDeepLink(url: string): void {
  const parsed = Linking.parse(url);
  if (parsed.path === null) return;

  const segments = parsed.path.split("/").filter(Boolean);
  if (segments.length === 0) return;

  const [section, id] = segments;

  switch (section) {
    case "dtr":
      router.push("/(app)/dtr/");
      break;
    case "tasks":
      if (id !== undefined) {
        router.push(`/(app)/tasks/${id}`);
      } else {
        router.push("/(app)/tasks/");
      }
      break;
    case "expenses":
      router.push("/(app)/expenses/");
      break;
    case "payslips":
      router.push("/(app)/payslips/");
      break;
    default:
      break;
  }
}
