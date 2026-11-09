import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: "800" },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Stickers AI" }} />
        <Stack.Screen name="create" options={{ title: "New pack", presentation: "modal" }} />
        <Stack.Screen name="job/[id]" options={{ title: "Making stickers", headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="pack/[id]" options={{ title: "" }} />
        <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
