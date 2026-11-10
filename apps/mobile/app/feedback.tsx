import { fmt, FEEDBACK_LIMITS, type FeedbackKind } from "@stickers/shared";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { success, tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

const KINDS: FeedbackKind[] = ["bug", "idea", "question", "other"];

/** Bug reports, ideas and support questions, sent to the API's /v1/feedback. */
export default function Feedback() {
  const { locale, m } = useI18n();
  const t = m.support;
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    tap();
    setError(undefined);
    if (message.trim().length < FEEDBACK_LIMITS.MESSAGE_MIN) return setError(t.tooShort);
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.badEmail);
    setBusy(true);
    try {
      await (await api()).sendFeedback({
        kind,
        message: message.trim(),
        email: email.trim() || undefined,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Constants.expoConfig?.version,
        locale,
      });
      success();
      setSent(true);
    } catch (e) {
      setError(fmt(t.sendError, { error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <View style={s.done}>
        <Text style={s.emoji}>💌</Text>
        <Text style={s.doneText}>{t.sent}</Text>
        <Pressable style={[s.button, { alignSelf: "stretch" }]} onPress={() => router.back()}>
          <Text style={s.buttonText}>{m.usage.gotIt}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.subtitle}>{t.feedbackSubtitle}</Text>
      <Text style={s.label}>{t.kind}</Text>
      <View style={s.chips}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k }}
            onPress={() => {
              tap();
              setKind(k);
            }}
            style={[s.chip, kind === k && s.chipOn]}
          >
            <Text style={[s.chipText, kind === k && { color: "#fff" }]}>{t.kinds[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>{t.message}</Text>
      <TextInput
        style={[s.input, { minHeight: 140, textAlignVertical: "top" }]}
        value={message}
        onChangeText={setMessage}
        placeholder={t.messagePlaceholder}
        placeholderTextColor={C.muted}
        multiline
        maxLength={FEEDBACK_LIMITS.MESSAGE_MAX}
      />

      <Text style={s.label}>{t.email}</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={FEEDBACK_LIMITS.EMAIL_MAX}
      />
      <Text style={s.hint}>{t.emailHint}</Text>

      {error && <Text style={s.error}>{error}</Text>}
      <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{t.send}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  subtitle: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginBottom: 8, lineHeight: 21 },
  label: { fontFamily: F.semibold, fontSize: 15, color: C.ink, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.ink },
  hint: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 6 },
  error: { fontFamily: F.medium, fontSize: 14, color: C.danger, marginTop: 16 },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  done: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emoji: { fontSize: 56 },
  doneText: { fontFamily: F.displayBold, fontSize: 22, color: C.ink, textAlign: "center", marginTop: 12, marginBottom: 8 },
});
