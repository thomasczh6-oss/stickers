import { fmt, type StickerPack } from "@stickers/shared";
import { Image } from "expo-image";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F, shadow } from "@/lib/theme";

const HERO = [
  require("@/assets/images/samples/knight-01.webp"),
  require("@/assets/images/samples/corgi-01.webp"),
  require("@/assets/images/samples/grandma-02.webp"),
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { locale, m } = useI18n();
  const t = m.app.home;
  const [packs, setPacks] = useState<StickerPack[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const { packs } = await (await api()).listMyPacks();
      setPacks(packs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = () => {
    tap();
    router.push("/create");
  };

  return (
    <FlatList
      data={packs ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={[s.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.muted}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
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

          <View style={s.sectionRow}>
            <Text style={s.section}>{t.myPacks}</Text>
            {!!packs?.length && <Text style={s.count}>{packs.length}</Text>}
          </View>
          {error && (
            <Pressable onPress={() => router.push("/settings")}>
              <Text style={s.error}>{t.serverError}</Text>
            </Pressable>
          )}
          {packs?.length === 0 && (
            <View style={s.empty}>
              <Image source={require("@/assets/images/styles/cartoon.png")} style={s.emptyImg} />
              <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
              <Text style={s.emptyBody}>{t.emptyBody}</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: "/pack/[id]", params: { id: item.id } }} asChild>
          <Pressable style={({ pressed }) => [s.card, pressed && s.pressed]}>
            <View style={s.thumbs}>
              {item.stickers.slice(0, 4).map((st) => (
                <Image key={st.id} source={st.url} style={s.thumb} contentFit="contain" />
              ))}
            </View>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.cardMeta}>
                  {fmt(m.pack.stickers, { n: item.stickers.length })} · {new Date(item.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={s.chev}>›</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 },
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
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  section: { fontFamily: F.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  count: { fontFamily: F.semibold, fontSize: 13, color: C.muted, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 12, borderWidth: 1, borderColor: C.line },
  thumbs: { flexDirection: "row", gap: 4, backgroundColor: C.bg, borderRadius: 18, padding: 8 },
  thumb: { flex: 1, aspectRatio: 1 },
  cardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 12, paddingBottom: 2 },
  cardTitle: { fontFamily: F.semibold, fontSize: 16, color: C.ink },
  cardMeta: { fontFamily: F.regular, color: C.muted, fontSize: 13, marginTop: 2 },
  chev: { fontSize: 26, color: C.muted, marginLeft: 8 },
  empty: { alignItems: "center", backgroundColor: C.card, borderRadius: 28, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", padding: 28, marginTop: 8 },
  emptyImg: { width: 96, height: 96 },
  emptyTitle: { fontFamily: F.displayBold, fontSize: 20, color: C.ink, marginTop: 8 },
  emptyBody: { fontFamily: F.regular, color: C.muted, marginTop: 4 },
  error: { fontFamily: F.regular, color: C.danger, marginVertical: 8 },
});
