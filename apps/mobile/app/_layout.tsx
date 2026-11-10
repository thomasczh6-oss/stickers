import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { type ErrorBoundaryProps, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { getMessages, matchLocale } from "@stickers/shared";
import { getLocales } from "expo-localization";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Onboarding } from "@/components/Onboarding";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { emailSupport } from "@/lib/links";
import { hasOnboarded, setOnboarded } from "@/lib/onboarding";
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
  // undefined until read from storage, so the welcome screens never flash for returning users.
  const [onboarded, setOnboardedState] = useState<boolean>();
  useEffect(() => {
    void hasOnboarded().then(setOnboardedState);
  }, []);
  const ready = (loaded || !!failed) && onboarded !== undefined;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  return (
    <I18nProvider>
      <Screens />
      {/* Drawn over the app, so a pack link that opened the app is still there after the welcome screens. */}
      {!onboarded && (
        <View style={StyleSheet.absoluteFill}>
          <Onboarding
            onDone={() => {
              setOnboardedState(true);
              void setOnboarded();
            }}
          />
        </View>
      )}
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
        <Stack.Screen name="settings" options={{ title: m.settings.title, presentation: "modal" }} />
        <Stack.Screen name="help" options={{ title: m.support.helpTitle }} />
        <Stack.Screen name="feedback" options={{ title: m.support.feedbackTitle }} />
        <Stack.Screen name="upgrade" options={{ title: m.usage.title, presentation: "modal" }} />
        <Stack.Screen name="job/[id]" options={{ title: "", headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="pack/[id]" options={{ title: "" }} />
        <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

/** Shown instead of a blank screen when something crashes while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const m = getMessages(matchLocale(getLocales().map((l) => l.languageTag)));
  useEffect(() => {
    console.error("[app] crashed", error);
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [error]);
  return (
    <View style={e.page}>
      <Text style={e.emoji}>🫠</Text>
      <Text style={e.title}>{m.errors.title}</Text>
      <Text style={e.body}>{m.errors.body}</Text>
      <Pressable style={e.button} onPress={retry} accessibilityRole="button">
        <Text style={e.buttonText}>{m.errors.retry}</Text>
      </Pressable>
      <Pressable onPress={() => emailSupport(`Stickers AI crash: ${error.message.slice(0, 80)}`)} hitSlop={10}>
        <Text style={e.link}>{m.support.contact}</Text>
      </Pressable>
    </View>
  );
}

// Plain system fonts: this screen may show before custom fonts load.
const e = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 },
  emoji: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: "800", color: C.ink, marginTop: 12, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, color: C.muted, marginTop: 8, textAlign: "center" },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, paddingHorizontal: 32, marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: C.ink, fontSize: 15, fontWeight: "600", textDecorationLine: "underline", marginTop: 18 },
});
