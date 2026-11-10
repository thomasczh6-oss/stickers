import { fmt, LOCALE_NAMES, LOCALES } from "@stickers/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { checkServer, getServerUrl, setServerUrl } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import { tap } from "@/lib/haptics";
import { type LanguagePreference, useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

/**
 * App language, plus (for testers) the API server the app talks to,
 * e.g. http://192.168.1.20:8787 on the same Wi-Fi.
 */
export default function Settings() {
  const { m, preference, setPreference } = useI18n();
  const t = m.app.settings;
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void getServerUrl().then(setUrl);
  }, []);

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
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>{t.language}</Text>
      <View style={s.list}>
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
              <Text style={[s.optionText, on && s.optionTextOn]}>{p === "device" ? t.phoneLanguage : LOCALE_NAMES[p]}</Text>
              {on && <Text style={s.tick}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.label, { marginTop: 28 }]}>{t.server}</Text>
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  list: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink },
  optionTextOn: { fontFamily: F.semibold },
  tick: { fontFamily: F.bold, fontSize: 16, color: C.brand },
  label: { fontFamily: F.semibold, fontSize: 15, color: C.ink, marginBottom: 8 },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.ink },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: { flex: 1, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, alignItems: "center" },
  secondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  status: { fontFamily: F.medium, fontSize: 14, marginTop: 18, textAlign: "center" },
});
