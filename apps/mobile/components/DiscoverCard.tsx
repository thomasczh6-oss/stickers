import { type DiscoverItem, styleName } from "@stickers/shared";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

/** A Discover pack: 2x2 sticker peek, title, creator and remix count. */
export function DiscoverCard({ item, width }: { item: DiscoverItem; width: number }) {
  const { m, d } = useDiscoverI18n();
  const thumb = (width - 24 - 4) / 2;
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push({ pathname: "/discover/[id]", params: { id: item.id } });
      }}
      style={({ pressed }) => [s.card, { width }, pressed && s.pressed]}
      accessibilityLabel={item.title}
    >
      <View style={s.thumbs}>
        {item.previewUrls.map((u) => (
          <Image key={u} source={u} style={{ width: thumb, height: thumb }} contentFit="contain" />
        ))}
        <Text style={s.style}>{styleName(m, item.style)}</Text>
        {item.mine && <Text style={s.mine}>{d.yours}</Text>}
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {item.creator}
          </Text>
        </View>
        <Text style={s.remix}>⇄ {item.remixCount}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 8 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 4, backgroundColor: C.bg, borderRadius: 16, padding: 4 },
  style: { position: "absolute", top: 6, left: 6, fontFamily: F.semibold, fontSize: 11, color: C.brand, backgroundColor: C.card, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  mine: { position: "absolute", top: 6, right: 6, fontFamily: F.semibold, fontSize: 11, color: C.ink, backgroundColor: C.sun, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  title: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 1 },
  remix: { fontFamily: F.semibold, fontSize: 12, color: C.muted, backgroundColor: C.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
});
