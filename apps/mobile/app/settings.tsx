import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { checkServer, getServerUrl, setServerUrl } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import { tap } from "@/lib/haptics";
import { C, F } from "@/lib/theme";

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

/** Lets testers point the app at their own API server, e.g. http://192.168.1.20:8787 on the same Wi-Fi. */
export default function Settings() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void getServerUrl().then(setUrl);
  }, []);

  async function test() {
    tap();
    setStatus({ kind: "checking" });
    try {
      setStatus({ kind: "ok", text: await checkServer(url) });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message || "Can’t reach this server" });
    }
  }

  async function save() {
    tap();
    await setServerUrl(url);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Server address</Text>
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
      <Text style={s.hint}>For testing: the address of the Stickers AI server. Your phone and the server must be on the same Wi‑Fi. Default: {API_BASE_URL}</Text>

      <View style={s.row}>
        <Pressable style={[s.button, s.secondary]} onPress={test}>
          <Text style={[s.buttonText, { color: C.ink }]}>Test connection</Text>
        </Pressable>
        <Pressable style={s.button} onPress={save}>
          <Text style={s.buttonText}>Save</Text>
        </Pressable>
      </View>

      {status.kind === "checking" && <ActivityIndicator style={{ marginTop: 20 }} color={C.brand} />}
      {status.kind === "ok" && <Text style={[s.status, { color: "#15803d" }]}>✓ {status.text}</Text>}
      {status.kind === "error" && <Text style={[s.status, { color: C.danger }]}>{status.text}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20 },
  label: { fontFamily: F.semibold, fontSize: 15, color: C.ink, marginBottom: 8 },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.ink },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: { flex: 1, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, alignItems: "center" },
  secondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  status: { fontFamily: F.medium, fontSize: 14, marginTop: 18, textAlign: "center" },
});
