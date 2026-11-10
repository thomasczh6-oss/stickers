import { type DiscoverItem, fmt, type StickerPack, styleName } from "@stickers/shared";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReportSheet } from "@/components/ReportSheet";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { type PickedPhoto, pickPhoto } from "@/lib/photo";
import { STYLE_IMAGES } from "@/lib/styleImages";
import { C, F } from "@/lib/theme";

/** A Discover pack, with "make it yours": same style, reactions and captions, the user's own photo. */
export default function DiscoverPack() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale, m, d } = useDiscoverI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 600) - 40 - 20) / 3);
  const [data, setData] = useState<{ item: DiscoverItem; pack: StickerPack }>();
  const [loadError, setLoadError] = useState<string>();
  const [photo, setPhoto] = useState<PickedPhoto>();
  const [describe, setDescribe] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData(await (await api()).getDiscoverItem(id));
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, [id]);

  async function choose() {
    tap();
    try {
      const p = await pickPhoto();
      if (p) {
        setPhoto(p);
        setDescribe(false);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function make() {
    if (!data) return;
    tap();
    setBusy(true);
    setError(undefined);
    try {
      const { job } = await (await api()).remix(id, {
        photo: photo && !describe ? { base64: photo.base64, mimeType: "image/jpeg" } : undefined,
        prompt: describe ? prompt.trim() : undefined,
        packName: data.item.title,
        locale,
      });
      router.replace({ pathname: "/job/[id]", params: { id: job.id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function block() {
    Alert.alert(d.block, d.blockBody, [
      { text: d.cancel, style: "cancel" },
      {
        text: d.block,
        style: "destructive",
        onPress: async () => {
          try {
            await (await api()).blockCreator(id);
            router.back();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  function more() {
    tap();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [d.report, d.block, d.cancel], destructiveButtonIndex: [0, 1], cancelButtonIndex: 2 }, (i) => {
        if (i === 0) setReporting(true);
        if (i === 1) block();
      });
    } else {
      Alert.alert(d.more, undefined, [
        { text: d.report, onPress: () => setReporting(true) },
        { text: d.block, onPress: block },
        { text: d.cancel, style: "cancel" },
      ]);
    }
  }

  if (loadError)
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <Text style={s.title}>{d.notFound}</Text>
        <Pressable onPress={() => router.back()} style={[s.button, { marginTop: 20, paddingHorizontal: 24 }]}>
          <Text style={s.buttonText}>{d.backToDiscover}</Text>
        </Pressable>
      </View>
    );
  if (!data) return <ActivityIndicator style={{ marginTop: 48 }} color={C.brand} />;
  const { item, pack } = data;
  const ready = describe ? prompt.trim().length > 0 : !!photo;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerRight: item.mine
            ? undefined
            : () => (
                <Pressable onPress={more} hitSlop={10} accessibilityLabel={d.more}>
                  <Text style={s.more}>•••</Text>
                </Pressable>
              ),
        }}
      />
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.trayWrap}>
            <Image source={item.trayIconUrl} style={s.tray} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={s.muted}>
              {fmt(d.by, { creator: item.creator })} · ⇄ {item.remixCount}
            </Text>
          </View>
        </View>

        <View style={s.grid}>
          {pack.stickers.map((st) => (
            <View key={st.id} style={[s.cell, { width: cell, height: cell }]}>
              <Image source={st.url} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityLabel={st.accessibilityText} />
            </View>
          ))}
        </View>

        <View style={s.chips}>
          <View style={[s.chip, s.chipBrand]}>
            <Image source={STYLE_IMAGES[item.style]} style={s.chipImg} />
            <Text style={[s.chipText, { color: C.brand }]}>{fmt(d.recipeStyle, { style: styleName(m, item.style) })}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipText}>{item.kind === "animated" ? d.recipeAnimated : d.recipeStill}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipText}>{fmt(d.recipeReactions, { n: item.stickerCount })}</Text>
          </View>
          {item.captions && (
            <View style={s.chip}>
              <Text style={s.chipText}>{d.recipeCaptions}</Text>
            </View>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{d.remixTitle}</Text>
          <Text style={s.cardBody}>{d.remixBody}</Text>
          {describe ? (
            <TextInput style={s.input} value={prompt} onChangeText={setPrompt} placeholder={d.describePlaceholder} placeholderTextColor={C.muted} maxLength={500} autoFocus />
          ) : (
            <Pressable style={s.photoRow} onPress={choose}>
              <View style={s.photo}>{photo ? <Image source={photo.uri} style={StyleSheet.absoluteFill} /> : <Text style={s.plus}>+</Text>}</View>
              <Text style={s.photoText}>{photo ? d.changePhoto : d.choosePhoto}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              tap();
              setDescribe((v) => !v);
            }}
            hitSlop={8}
          >
            <Text style={s.link}>{describe ? d.choosePhoto : d.orDescribe}</Text>
          </Pressable>
          <Text style={s.note}>{d.photoNote}</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable style={[s.button, (!ready || busy) && { opacity: 0.4 }]} disabled={!ready || busy} onPress={make}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{ready ? d.makeMine : d.useThis}</Text>}
        </Pressable>
      </View>

      <ReportSheet
        id={id}
        visible={reporting}
        onClose={() => setReporting(false)}
        onDone={() => {
          setReporting(false);
          Alert.alert(d.reported, undefined, [{ text: "OK", onPress: () => router.back() }]);
        }}
      />
    </>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingTop: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  trayWrap: { width: 60, height: 60, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  tray: { width: 48, height: 48 },
  title: { fontFamily: F.display, fontSize: 26, lineHeight: 29, color: C.ink, letterSpacing: -0.5 },
  muted: { fontFamily: F.regular, color: C.muted, marginTop: 3, fontSize: 14 },
  more: { fontFamily: F.bold, color: C.ink, fontSize: 16, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  cell: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: 99, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 6 },
  chipBrand: { backgroundColor: C.brandSoft, borderColor: C.brandSoft, paddingLeft: 4 },
  chipImg: { width: 22, height: 22, borderRadius: 11 },
  chipText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  card: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 18, marginTop: 18, gap: 10 },
  cardTitle: { fontFamily: F.display, fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  cardBody: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.muted },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 },
  photo: { width: 84, height: 84, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: C.line, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  plus: { fontSize: 30, color: C.muted, fontFamily: F.regular },
  photoText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  input: { backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: F.regular, color: C.ink },
  link: { fontFamily: F.semibold, fontSize: 14, color: C.muted, textDecorationLine: "underline" },
  note: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  error: { fontFamily: F.regular, color: C.danger, marginBottom: 10, textAlign: "center" },
});
