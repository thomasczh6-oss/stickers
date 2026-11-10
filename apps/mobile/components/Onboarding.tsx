import { Image } from "expo-image";
import { useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegalLine } from "@/components/LegalLine";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

const ART = [
  [require("@/assets/images/samples/corgi-01.webp"), require("@/assets/images/samples/girl-01.webp"), require("@/assets/images/samples/cat-01.webp")],
  [require("@/assets/images/samples/knight-02.webp"), require("@/assets/images/samples/grandma-01.webp"), require("@/assets/images/samples/sloth-01.webp")],
  [require("@/assets/images/samples/leo-01.webp"), require("@/assets/images/samples/zoe-02.webp"), require("@/assets/images/samples/joe-01.webp")],
];

/** First-run welcome: three swipeable cards; the last one carries the terms and AI photo notice. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { m } = useI18n();
  const t = m.onboarding;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === t.slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => {
    tap();
    if (last) return onDone();
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[s.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.top}>
        {!last && (
          <Pressable
            hitSlop={12}
            onPress={() => scroller.current?.scrollTo({ x: (t.slides.length - 1) * width, animated: true })}
            accessibilityRole="button"
          >
            <Text style={s.skip}>{t.skip}</Text>
          </Pressable>
        )}
      </View>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        {t.slides.map((slide, i) => (
          <View key={i} style={[s.slide, { width }]}>
            <View style={s.art}>
              {ART[i]!.map((src, j) => (
                <Image key={j} source={src} style={[s.sticker, { transform: [{ rotate: `${(j - 1) * 9}deg` }, { translateY: j === 1 ? -14 : 6 }] }]} />
              ))}
            </View>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.dots}>
        {t.slides.map((_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>
      <View style={s.footer}>
        <Pressable style={({ pressed }) => [s.button, pressed && { opacity: 0.85 }]} onPress={next} accessibilityRole="button">
          <Text style={s.buttonText}>{last ? t.start : t.next}</Text>
        </Pressable>
        <LegalLine template={m.legal.agree} style={{ marginTop: 14, opacity: last ? 1 : 0 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  top: { height: 32, alignItems: "flex-end", paddingHorizontal: 20, justifyContent: "center" },
  skip: { fontFamily: F.medium, fontSize: 15, color: C.muted },
  slide: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  art: { flexDirection: "row", justifyContent: "center", marginBottom: 36 },
  sticker: { width: 120, height: 120, marginHorizontal: -10 },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 37, color: C.ink, letterSpacing: -0.7, textAlign: "center" },
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.muted, textAlign: "center", marginTop: 14 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.line },
  dotOn: { width: 24, backgroundColor: C.ink },
  footer: { paddingHorizontal: 24 },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
});
