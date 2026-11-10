import type { DiscoverItem } from "@stickers/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";
import { DiscoverCard } from "./DiscoverCard";

/** Home screen: a sideways row of trending Discover packs, with a link to the full feed. */
export function DiscoverStrip() {
  const { d } = useDiscoverI18n();
  const [items, setItems] = useState<DiscoverItem[]>();

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          setItems((await (await api()).discover({ sort: "trending", limit: 10 })).items);
        } catch {
          setItems([]);
        }
      })();
    }, []),
  );

  const open = () => {
    tap();
    router.push("/discover");
  };

  if (items && items.length === 0) {
    // Nothing public yet: still show the way in, so people can find the feed later.
    return (
      <Pressable style={s.empty} onPress={open}>
        <Text style={s.title}>{d.title}</Text>
        <Text style={s.emptyBody}>{d.subtitle}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ marginBottom: 28 }}>
      <Pressable style={s.header} onPress={open} hitSlop={8}>
        <Text style={s.title}>{d.title}</Text>
        <Text style={s.all}>{d.sort.trending} ›</Text>
      </Pressable>
      <FlatList
        horizontal
        data={items ?? []}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        renderItem={({ item }) => <DiscoverCard item={item} width={150} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  all: { fontFamily: F.semibold, fontSize: 14, color: C.brand },
  empty: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 18, marginBottom: 28, gap: 4 },
  emptyBody: { fontFamily: F.regular, fontSize: 14, color: C.muted, lineHeight: 20 },
});
