import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = loaded || !!failed;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  return (
    <I18nProvider>
      <Screens />
    </I18nProvider>
  );
}

function Screens() {
  const { m } = useI18n();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerTintColor: C.ink,
          headerTitleStyle: { fontFamily: F.displayBold, fontSize: 18 },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: m.app.titles.newPack, presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ title: m.app.titles.settings, presentation: "modal" }} />
        <Stack.Screen name="job/[id]" options={{ title: "", headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="pack/[id]" options={{ title: "" }} />
        <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="discover/index" options={{ title: "" }} />
        <Stack.Screen name="discover/[id]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
