import type { StickerPack } from "@stickers/shared";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { SITE_URL, STORE_LINKS } from "@/lib/env";
import { success, tap } from "@/lib/haptics";
import { savePackForWhatsApp } from "@/lib/packFiles";
import { shareSticker } from "@/lib/shareSticker";
import { C, F } from "@/lib/theme";
import * as WhatsApp from "@/modules/whatsapp-stickers";

type AddState = { kind: "idle" } | { kind: "saving"; done: number; total: number } | { kind: "opening" } | { kind: "added" } | { kind: "error"; message: string };

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pack, setPack] = useState<StickerPack>();
  const [error, setError] = useState<string>();
  const [add, setAdd] = useState<AddState>({ kind: "idle" });
  const [sharing, setSharing] = useState<number>();
  const [shareError, setShareError] = useState<string>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Three columns: page padding 20 on each side, 10 between cells.
  const cell = Math.floor((Math.min(width, 600) - 40 - 20) / 3);

  useEffect(() => {
    (async () => {
      try {
        const { pack } = await (await api()).getPack(id);
        setPack(pack);
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
    await Share.share(Platform.OS === "ios" ? { url, message: `My sticker pack “${pack.name}”` } : { message: `My sticker pack “${pack.name}”: ${url}` }).catch(() => undefined);
  }

  async function sendSticker(index: number) {
    if (!pack || sharing !== undefined) return;
    tap();
    setShareError(undefined);
    setSharing(index);
    try {
      await shareSticker(pack, index);
    } catch (e) {
      setShareError((e as Error).message);
    } finally {
      setSharing(undefined);
    }
  }

  function addToTelegram() {
    const url = pack?.exports?.telegramUrl;
    if (!url) return;
    tap();
    Linking.openURL(url).catch(() => setShareError("Couldn’t open Telegram."));
  }

  async function addToWhatsApp() {
    if (!pack) return;
    tap();
    try {
      if (!(await WhatsApp.isWhatsAppInstalled())) {
        return setAdd({ kind: "error", message: "WhatsApp isn’t installed on this phone." });
      }
      setAdd({ kind: "saving", done: 0, total: pack.stickers.length + 1 });
      const dir = await savePackForWhatsApp(pack, (done, total) => setAdd({ kind: "saving", done, total }));
      setAdd({ kind: "opening" });
      const res = await WhatsApp.addPack({ identifier: pack.identifier, name: pack.name, directory: dir.uri }, STORE_LINKS);
      if (res.added) {
        success();
        setAdd(Platform.OS === "ios" ? { kind: "idle" } : { kind: "added" });
      }
      else setAdd({ kind: "error", message: res.error ? `WhatsApp said: ${res.error}` : "The pack wasn’t added." });
    } catch (e) {
      setAdd({ kind: "error", message: (e as Error).message });
    }
  }

  if (error)
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <Text style={s.title}>Couldn’t open this pack</Text>
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
              <Text style={s.share}>Share</Text>
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
              {pack.stickers.length} {pack.animated ? "animated " : ""}stickers · made with {pack.publisher}
            </Text>
          </View>
        </View>

        <View style={s.grid}>
          {pack.stickers.map((st, i) => (
            <Pressable
              key={st.id}
              onPress={() => sendSticker(i)}
              accessibilityRole="button"
              accessibilityLabel={`Send sticker: ${st.accessibilityText}`}
              style={({ pressed }) => [s.cell, { width: cell, height: cell }, (pressed || sharing === i) && { opacity: 0.6 }]}
            >
              <Image source={st.url} style={s.sticker} contentFit="contain" />
            </Pressable>
          ))}
        </View>

        <View style={s.more}>
          <Text style={s.moreTitle}>Other apps</Text>
          <Text style={s.muted}>
            Tap a sticker to send it {pack.animated ? "as a GIF " : ""}in iMessage, Messenger, Instagram, Signal or any other chat.
          </Text>
          {shareError && <Text style={[s.error, { marginTop: 8, marginBottom: 0 }]}>{shareError}</Text>}
          {pack.exports?.telegramUrl && (
            <Pressable style={s.telegram} onPress={addToTelegram}>
              <Text style={s.buttonText}>Add to Telegram</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {add.kind === "error" && <Text style={s.error}>{add.message}</Text>}
        <Pressable style={[s.button, (busy || add.kind === "added") && s.buttonDim]} disabled={busy || add.kind === "added"} onPress={addToWhatsApp}>
          {busy ? (
            <Text style={s.buttonText}>{add.kind === "saving" ? `Preparing ${add.done}/${add.total}…` : "Opening WhatsApp…"}</Text>
          ) : (
            <Text style={s.buttonText}>{add.kind === "added" ? "Added to WhatsApp ✓" : "Add to WhatsApp"}</Text>
          )}
        </Pressable>
        {!WhatsApp.isAvailable ? (
          <Text style={s.note}>Adding to WhatsApp needs the full app build; it isn’t available in this preview.</Text>
        ) : (
          <Text style={s.note}>{add.kind === "added" ? "Find it in your WhatsApp sticker tray." : "WhatsApp will ask you to confirm."}</Text>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  cell: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 6 },
  sticker: { width: "100%", height: "100%" },
  more: { marginTop: 26, padding: 18, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  moreTitle: { fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: 2 },
  telegram: { marginTop: 14, backgroundColor: "#2aabee", borderRadius: 99, paddingVertical: 14, alignItems: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonDim: { opacity: 0.6 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  error: { fontFamily: F.regular, color: C.danger, marginBottom: 10, textAlign: "center" },
  note: { fontFamily: F.regular, color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
