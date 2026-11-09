import type { StickerPack } from "@stickers/shared";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { STORE_LINKS } from "@/lib/env";
import { savePackForWhatsApp } from "@/lib/packFiles";
import { C } from "@/lib/theme";
import * as WhatsApp from "@/modules/whatsapp-stickers";

type AddState = { kind: "idle" } | { kind: "saving"; done: number; total: number } | { kind: "opening" } | { kind: "added" } | { kind: "error"; message: string };

export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pack, setPack] = useState<StickerPack>();
  const [error, setError] = useState<string>();
  const [add, setAdd] = useState<AddState>({ kind: "idle" });

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

  async function addToWhatsApp() {
    if (!pack) return;
    try {
      if (!(await WhatsApp.isWhatsAppInstalled())) {
        return setAdd({ kind: "error", message: "WhatsApp isn’t installed on this phone." });
      }
      setAdd({ kind: "saving", done: 0, total: pack.stickers.length + 1 });
      const dir = await savePackForWhatsApp(pack, (done, total) => setAdd({ kind: "saving", done, total }));
      setAdd({ kind: "opening" });
      const res = await WhatsApp.addPack({ identifier: pack.identifier, name: pack.name, directory: dir.uri }, STORE_LINKS);
      if (res.added) setAdd(Platform.OS === "ios" ? { kind: "idle" } : { kind: "added" });
      else setAdd({ kind: "error", message: res.error ? `WhatsApp said: ${res.error}` : "The pack wasn’t added." });
    } catch (e) {
      setAdd({ kind: "error", message: (e as Error).message });
    }
  }

  if (error) return <Text style={[s.error, { padding: 24 }]}>{error}</Text>;
  if (!pack) return <ActivityIndicator style={{ marginTop: 48 }} color={C.brand} />;

  const busy = add.kind === "saving" || add.kind === "opening";
  return (
    <>
      <Stack.Screen options={{ title: pack.name }} />
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.header}>
          <Image source={pack.trayIconUrl} style={s.tray} />
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={2}>
              {pack.name}
            </Text>
            <Text style={s.muted}>
              {pack.stickers.length} {pack.animated ? "animated " : ""}stickers · {pack.publisher}
            </Text>
          </View>
        </View>

        <View style={s.grid}>
          {pack.stickers.map((st) => (
            <View key={st.id} style={s.cell}>
              <Image source={st.url} style={s.sticker} contentFit="contain" accessibilityLabel={st.accessibilityText} />
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        {add.kind === "error" && <Text style={s.error}>{add.message}</Text>}
        <Pressable style={[s.button, (busy || add.kind === "added") && s.buttonDim]} disabled={busy || add.kind === "added"} onPress={addToWhatsApp}>
          {busy ? (
            <Text style={s.buttonText}>{add.kind === "saving" ? `Preparing ${add.done}/${add.total}…` : "Opening WhatsApp…"}</Text>
          ) : (
            <Text style={s.buttonText}>{add.kind === "added" ? "Added to WhatsApp ✓" : "Add to WhatsApp"}</Text>
          )}
        </Pressable>
        {!WhatsApp.isAvailable && <Text style={s.note}>Adding to WhatsApp needs a development build; it does not work in Expo Go.</Text>}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  tray: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.soft },
  title: { fontSize: 22, fontWeight: "900", color: C.ink },
  muted: { color: C.muted, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  cell: { width: "31.5%", aspectRatio: 1, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 4 },
  sticker: { width: "100%", height: "100%" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 34, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line },
  button: { backgroundColor: "#16a34a", borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonDim: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  error: { color: C.danger, marginBottom: 10, textAlign: "center" },
  note: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
