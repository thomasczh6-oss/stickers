import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "stickers.onboarded";

/** Whether this phone has seen the welcome screens and accepted the terms. */
export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY).catch(() => null)) === "1";
}

export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
