import { fmt, hoursUntil, LOCALE_NAMES, LOCALES, type Usage } from "@stickers/shared";
import Constants from "expo-constants";
import { Directory, Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Group, Row } from "@/components/Rows";
import { api, checkServer, getServerUrl, resetDeviceId, setServerUrl } from "@/lib/api";
import { API_BASE_URL, SHOW_DEV_SETTINGS } from "@/lib/env";
import { success, tap } from "@/lib/haptics";
import { type LanguagePreference, useI18n } from "@/lib/i18n";
import { openSitePage, RATE_URL } from "@/lib/links";
import { usageLine } from "@/lib/usage";
import { C, F } from "@/lib/theme";
import * as WhatsApp from "@/modules/whatsapp-stickers";

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

/** Plan, language, help, legal, data deletion and (for testers) the API server address. */
export default function Settings() {
  const { m, preference, setPreference } = useI18n();
  const t = m.settings;
  const [usage, setUsage] = useState<Usage>();
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void api()
        .then((a) => a.getUsage())
        .then((r) => setUsage(r.usage))
        .catch(() => undefined);
    }, []),
  );

  function confirmDelete() {
    Alert.alert(m.data.confirmTitle, m.data.confirmBody, [
      { text: m.data.cancel, style: "cancel" },
      { text: m.data.confirm, style: "destructive", onPress: () => void deleteAll() },
    ]);
  }

  async function deleteAll() {
    setDeleting(true);
    try {
      await (await api()).deleteMyData();
      // Also remove the pack files saved on this phone for WhatsApp, and start over with a new anonymous id.
      const root = WhatsApp.packsDirectory ? new Directory(WhatsApp.packsDirectory) : new Directory(Paths.document, "sticker_packs");
      try {
        if (root.exists) for (const item of root.list()) item.delete();
      } catch {
        // Files WhatsApp still has open are cleaned up next time.
      }
      await resetDeviceId();
      success();
      Alert.alert(m.data.done);
      router.dismissAll();
    } catch (e) {
      Alert.alert(fmt(m.data.error, { error: (e as Error).message }));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Group title={t.plan} footer={usage && usage.limit > 0 && usage.remaining <= 0 ? fmt(m.usage.resets, { h: hoursUntil(usage.resetsAt) }) : undefined}>
        <Row first label={usage ? usageLine(m, usage) : "…"} onPress={() => router.push("/upgrade")} />
      </Group>

      <Group title={m.app.settings.language}>
        {(["device", ...LOCALES] as LanguagePreference[]).map((p, i) => {
          const on = preference === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                void setPreference(p);
              }}
              style={[s.option, i > 0 && s.optionBorder]}
            >
              <Text style={[s.optionText, on && s.optionTextOn]}>{p === "device" ? m.app.settings.phoneLanguage : LOCALE_NAMES[p]}</Text>
              {on && <Text style={s.tick}>✓</Text>}
            </Pressable>
          );
        })}
      </Group>

      <Group title={t.help}>
        <Row first label={t.helpFaq} onPress={() => router.push("/help")} />
        <Row label={t.feedback} onPress={() => router.push("/feedback")} />
        {!!RATE_URL && <Row label={t.rate} onPress={() => void Linking.openURL(RATE_URL!).catch(() => undefined)} />}
      </Group>

      <Group title={t.legal}>
        <Row first label={m.legal.terms} onPress={() => openSitePage("/terms")} />
        <Row label={m.legal.privacy} onPress={() => openSitePage("/privacy")} />
      </Group>

      <Group title={t.yourData} footer={m.data.body}>
        {deleting ? (
          <View style={s.deleting}>
            <ActivityIndicator color={C.danger} />
            <Text style={[s.optionText, { color: C.danger }]}>{m.data.deleting}</Text>
          </View>
        ) : (
          <Row first danger chevron={false} label={m.data.button} onPress={confirmDelete} />
        )}
      </Group>

      <Group title={t.about}>
        <Row first label="Stickers AI" value={fmt(t.version, { v: Constants.expoConfig?.version ?? "?" })} />
      </Group>

      {SHOW_DEV_SETTINGS && <ServerSetting />}
    </ScrollView>
  );
}

/** Testers point the app at a server on the same Wi-Fi, e.g. http://192.168.1.20:8787. Hidden in store builds. */
function ServerSetting() {
  const { m } = useI18n();
  const t = m.app.settings;
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useFocusEffect(
    useCallback(() => {
      void getServerUrl().then(setUrl);
    }, []),
  );

  async function test() {
    tap();
    setStatus({ kind: "checking" });
    try {
      const model = await checkServer(url);
      setStatus({ kind: "ok", text: model ? `${t.connected} · ${model}` : t.connected });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message || t.cantReach });
    }
  }

  async function save() {
    tap();
    await setServerUrl(url);
    router.back();
  }

  return (
    <View>
      <Text style={s.label}>
        {m.settings.developer} · {t.server}
      </Text>
      <TextInput
        style={s.input}
        value={url}
        onChangeText={(v) => {
          setUrl(v);
          setStatus({ kind: "idle" });
        }}
        placeholder="http://192.168.1.20:8787"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={s.hint}>{fmt(t.serverHint, { url: API_BASE_URL })}</Text>
      <View style={s.row}>
        <Pressable style={[s.button, s.secondary]} onPress={test}>
          <Text style={[s.buttonText, { color: C.ink }]}>{t.test}</Text>
        </Pressable>
        <Pressable style={s.button} onPress={save}>
          <Text style={s.buttonText}>{t.save}</Text>
        </Pressable>
      </View>
      {status.kind === "checking" && <ActivityIndicator style={{ marginTop: 20 }} color={C.brand} />}
      {status.kind === "ok" && <Text style={[s.status, { color: "#15803d" }]}>✓ {status.text}</Text>}
      {status.kind === "error" && <Text style={[s.status, { color: C.danger }]}>{status.text}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink },
  optionTextOn: { fontFamily: F.semibold },
  tick: { fontFamily: F.bold, fontSize: 16, color: C.brand },
  deleting: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  label: { fontFamily: F.semibold, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.ink },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: { flex: 1, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, alignItems: "center" },
  secondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  status: { fontFamily: F.medium, fontSize: 14, marginTop: 18, textAlign: "center" },
});
