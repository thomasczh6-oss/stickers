import type { StickerPack } from "@stickers/shared";
import { Image } from "expo-image";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";

export default function Home() {
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

  return (
    <FlatList
      data={packs ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={s.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <Pressable style={s.hero} onPress={() => router.push("/create")}>
            <Text style={s.heroTitle}>Make a new pack</Text>
            <Text style={s.heroBody}>A selfie, your pet or any idea, turned into animated WhatsApp stickers.</Text>
            <View style={s.heroButton}>
              <Text style={s.heroButtonText}>Start</Text>
            </View>
          </Pressable>
          <Text style={s.section}>My packs</Text>
          {error && <Text style={s.error}>{error}</Text>}
          {packs?.length === 0 && <Text style={s.muted}>No packs yet. Your first one takes about a minute.</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: "/pack/[id]", params: { id: item.id } }} asChild>
          <Pressable style={s.card}>
            <View style={s.thumbs}>
              {item.stickers.slice(0, 3).map((st) => (
                <Image key={st.id} source={st.url} style={s.thumb} contentFit="contain" />
              ))}
            </View>
            <Text style={s.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={s.muted}>
              {item.stickers.length} stickers · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  hero: { backgroundColor: C.brand, borderRadius: 28, padding: 24, marginBottom: 20 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },
  heroBody: { color: "#f3e8ff", fontSize: 15, marginTop: 6, lineHeight: 21 },
  heroButton: { alignSelf: "flex-start", backgroundColor: C.accent, borderRadius: 99, paddingHorizontal: 22, paddingVertical: 11, marginTop: 18 },
  heroButtonText: { color: C.ink, fontWeight: "800", fontSize: 16 },
  section: { fontSize: 20, fontWeight: "900", color: C.ink, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: C.line },
  thumbs: { flexDirection: "row", gap: 6 },
  thumb: { flex: 1, aspectRatio: 1 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: C.ink, marginTop: 10 },
  muted: { color: C.muted, fontSize: 13, marginTop: 2 },
  error: { color: C.danger, marginBottom: 8 },
});
