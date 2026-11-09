import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Light tap feedback on buttons. A no-op on the web. */
export function tap() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function success() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
