import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PackLibrary } from "@/components/PackLibrary";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F, shadow } from "@/lib/theme";

const HERO = [
  require("@/assets/images/samples/knight-01.webp"),
  require("@/assets/images/samples/corgi-01.webp"),
  require("@/assets/images/samples/grandma-02.webp"),
];

export default function Home() {
  const { m } = useI18n();
  const t = m.app.home;

  const create = () => {
    tap();
    router.push("/create");
  };

  return (
    <PackLibrary
      header={
        <View>
          <View style={s.top}>
            <Image source={require("@/assets/images/icon.png")} style={s.logo} />
            <Text style={s.brand}>Stickers AI</Text>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={s.settings} accessibilityLabel={t.settings}>
              <Text style={s.settingsText}>{t.settings}</Text>
            </Pressable>
          </View>

          <View style={s.hero}>
            <View style={s.heroStickers}>
              {HERO.map((src, i) => (
                <Image key={i} source={src} style={[s.heroSticker, { transform: [{ rotate: `${(i - 1) * 8}deg` }, { translateY: i === 1 ? -6 : 4 }] }]} />
              ))}
            </View>
            <Text style={s.heroTitle}>{t.heroTitle}</Text>
            <Text style={s.heroBody}>{t.heroBody}</Text>
            <Pressable style={({ pressed }) => [s.heroButton, pressed && s.pressed]} onPress={create}>
              <Text style={s.heroButtonText}>{t.create}</Text>
            </Pressable>
          </View>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  logo: { width: 32, height: 32, borderRadius: 9 },
  settings: { marginLeft: "auto", borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  settingsText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  brand: { fontFamily: F.display, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  hero: { backgroundColor: C.ink, borderRadius: 32, padding: 24, paddingTop: 20, marginBottom: 28, ...shadow },
  heroStickers: { flexDirection: "row", justifyContent: "center", marginBottom: 8 },
  heroSticker: { width: 96, height: 96, marginHorizontal: -6 },
  heroTitle: { fontFamily: F.display, fontSize: 30, lineHeight: 32, color: "#fff", letterSpacing: -0.6 },
  heroBody: { fontFamily: F.regular, color: "rgba(255,255,255,0.72)", fontSize: 15, marginTop: 10, lineHeight: 21 },
  heroButton: { backgroundColor: C.sun, borderRadius: 99, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  heroButtonText: { fontFamily: F.semibold, color: C.ink, fontSize: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
