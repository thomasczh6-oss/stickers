import { fmt, type PublishState, type StickerPack } from "@stickers/shared";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PublishRow } from "@/components/PublishSheet";
import { api } from "@/lib/api";
import { SITE_URL, STORE_LINKS } from "@/lib/env";
import { success, tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { savePackForWhatsApp } from "@/lib/packFiles";
import { C, F } from "@/lib/theme";
import * as WhatsApp from "@/modules/whatsapp-stickers";

type AddState = { kind: "idle" } | { kind: "saving"; done: number; total: number } | { kind: "opening" } | { kind: "added" } | { kind: "error"; message: string };

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m, d } = useDiscoverI18n();
  const t = m.app.pack;
  const [publish, setPublish] = useState<PublishState>();
  const [pack, setPack] = useState<StickerPack>();
  const [error, setError] = useState<string>();
  const [add, setAdd] = useState<AddState>({ kind: "idle" });
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Three columns: page padding 20 on each side, 10 between cells.
  const cell = Math.floor((Math.min(width, 600) - 40 - 20) / 3);

  useEffect(() => {
    (async () => {
      try {
        const { pack } = await (await api()).getPack(id);
        setPack(pack);
        // Only the creator gets an answer; anyone else simply doesn't see the Discover row.
        void (await api()).getPublishState(pack.id).then(setPublish, () => undefined);
        if (await WhatsApp.isPackAdded(pack.identifier)) setAdd({ kind: "added" });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  async function share() {
    if (!pack) return;
    tap();
    const url = `${SITE_URL}/p/${pack.id}`;
    const message = fmt(t.shareMessage, { name: pack.name });
    await Share.share(Platform.OS === "ios" ? { url, message } : { message: `${message}: ${url}` }).catch(() => undefined);
  }

  async function addToWhatsApp() {
    if (!pack) return;
    tap();
    try {
      if (!(await WhatsApp.isWhatsAppInstalled())) {
        return setAdd({ kind: "error", message: t.noWhatsApp });
      }
      setAdd({ kind: "saving", done: 0, total: pack.stickers.length + 1 });
      const dir = await savePackForWhatsApp(pack, (done, total) => setAdd({ kind: "saving", done, total }));
      setAdd({ kind: "opening" });
      const res = await WhatsApp.addPack({ identifier: pack.identifier, name: pack.name, directory: dir.uri }, STORE_LINKS);
      if (res.added) {
        success();
        setAdd(Platform.OS === "ios" ? { kind: "idle" } : { kind: "added" });
      }
      else setAdd({ kind: "error", message: res.error ? fmt(t.whatsAppSaid, { error: res.error }) : t.notAdded });
    } catch (e) {
      setAdd({ kind: "error", message: (e as Error).message });
    }
  }

  if (error)
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <Text style={s.title}>{t.openError}</Text>
        <Text style={[s.muted, { textAlign: "center", marginTop: 8 }]}>{error}</Text>
      </View>
    );
  if (!pack) return <ActivityIndicator style={{ marginTop: 48 }} color={C.brand} />;

  const busy = add.kind === "saving" || add.kind === "opening";
  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Pressable onPress={share} hitSlop={10}>
              <Text style={s.share}>{t.share}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 150 }]}>
        <View style={s.header}>
          <View style={s.trayWrap}>
            <Image source={pack.trayIconUrl} style={s.tray} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={2}>
              {pack.name}
            </Text>
            <Text style={s.muted}>
              {fmt(pack.animated ? m.pack.animatedStickers : m.pack.stickers, { n: pack.stickers.length })} · {fmt(t.madeWith, { publisher: pack.publisher })}
            </Text>
            {pack.remixOf && (
              <Pressable onPress={() => router.push({ pathname: "/discover/[id]", params: { id: pack.remixOf! } })} hitSlop={6}>
                <Text style={s.remixOf}>{d.remixedFrom} ›</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={s.grid}>
          {pack.stickers.map((st) => (
            <View key={st.id} style={[s.cell, { width: cell, height: cell }]}>
              <Image source={st.url} style={s.sticker} contentFit="contain" accessibilityLabel={st.accessibilityText} />
            </View>
          ))}
        </View>

        {publish && <PublishRow packId={pack.id} name={pack.name} state={publish} onChange={setPublish} />}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {add.kind === "error" && <Text style={s.error}>{add.message}</Text>}
        <Pressable style={[s.button, (busy || add.kind === "added") && s.buttonDim]} disabled={busy || add.kind === "added"} onPress={addToWhatsApp}>
          {busy ? (
            <Text style={s.buttonText}>{add.kind === "saving" ? fmt(t.preparing, { done: add.done, total: add.total }) : t.opening}</Text>
          ) : (
            <Text style={s.buttonText}>{add.kind === "added" ? t.added : m.pack.addToWhatsApp}</Text>
          )}
        </Pressable>
        {!WhatsApp.isAvailable ? (
          <Text style={s.note}>{t.previewOnly}</Text>
        ) : (
          <Text style={s.note}>{add.kind === "added" ? t.findInTray : t.confirm}</Text>
        )}
      </View>
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
  share: { fontFamily: F.semibold, color: C.ink, fontSize: 16 },
  remixOf: { fontFamily: F.semibold, color: C.brand, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  cell: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 6 },
  sticker: { width: "100%", height: "100%" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonDim: { opacity: 0.6 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  error: { fontFamily: F.regular, color: C.danger, marginBottom: 10, textAlign: "center" },
  note: { fontFamily: F.regular, color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
