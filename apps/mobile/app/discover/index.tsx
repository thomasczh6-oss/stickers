import { type DiscoverItem, type DiscoverSort, fmt, STYLES, styleName } from "@stickers/shared";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoverCard } from "@/components/DiscoverCard";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { STYLE_IMAGES } from "@/lib/styleImages";
import { C, F } from "@/lib/theme";

const SORTS: DiscoverSort[] = ["trending", "new", "top"];

/** The public feed in two columns, with sort and style filters and endless scrolling. */
export default function Discover() {
  const { m, d } = useDiscoverI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const card = Math.floor((Math.min(width, 600) - 40 - 12) / 2);
  const [sort, setSort] = useState<DiscoverSort>("trending");
  const [style, setStyle] = useState("");
  const [items, setItems] = useState<DiscoverItem[]>();
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (next?: string) => {
      try {
        setError(undefined);
        const page = await (await api()).discover({ sort, style, cursor: next });
        setItems((cur) => (next && cur ? [...cur, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [sort, style],
  );

  useEffect(() => {
    setItems(undefined);
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: d.title }} />
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
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
        onEndReachedThreshold={0.6}
        onEndReached={async () => {
          if (!cursor || loadingMore) return;
          setLoadingMore(true);
          await load(cursor);
          setLoadingMore(false);
        }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Text style={s.subtitle}>{d.subtitle}</Text>
            <View style={s.segment}>
              {SORTS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    tap();
                    setSort(k);
                  }}
                  style={[s.segmentItem, sort === k && s.segmentOn]}
                >
                  <Text style={[s.segmentText, sort === k && s.segmentTextOn]} numberOfLines={1}>
                    {d.sort[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -20 }}>
              <View style={{ width: 14 }} />
              {["", ...STYLES.map((x) => x.id)].map((id) => {
                const on = style === id;
                return (
                  <Pressable
                    key={id || "all"}
                    onPress={() => {
                      tap();
                      setStyle(id);
                    }}
                    style={[s.chip, on && s.chipOn, !id && { paddingLeft: 12 }]}
                  >
                    {!!id && <Image source={STYLE_IMAGES[id as keyof typeof STYLE_IMAGES]} style={s.chipImg} />}
                    <Text style={[s.chipText, on && { color: "#fff" }]}>{id ? styleName(m, id) : d.allStyles}</Text>
                  </Pressable>
                );
              })}
              <View style={{ width: 14 }} />
            </ScrollView>
            {error && <Text style={s.error}>{fmt(d.loadError, { error })}</Text>}
            {!items && !error && <ActivityIndicator style={{ marginTop: 32 }} color={C.brand} />}
            {items?.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{d.emptyTitle}</Text>
                <Text style={s.emptyBody}>{d.emptyBody}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <DiscoverCard item={item} width={card} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 16 }} color={C.muted} /> : undefined}
      />
    </>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 4 },
  subtitle: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: C.muted },
  segment: { flexDirection: "row", backgroundColor: C.card, borderRadius: 99, padding: 4, borderWidth: 1, borderColor: C.line },
  segmentItem: { flex: 1, borderRadius: 99, paddingVertical: 9, paddingHorizontal: 6, alignItems: "center" },
  segmentOn: { backgroundColor: C.ink },
  segmentText: { fontFamily: F.semibold, fontSize: 13, color: C.muted },
  segmentTextOn: { color: "#fff" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 4, paddingLeft: 4, paddingRight: 12 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipImg: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.bg },
  chipText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  error: { fontFamily: F.regular, color: C.danger, fontSize: 14 },
  empty: { alignItems: "center", padding: 32, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", marginTop: 8 },
  emptyTitle: { fontFamily: F.display, fontSize: 22, color: C.ink },
  emptyBody: { fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: "center", marginTop: 6 },
});
