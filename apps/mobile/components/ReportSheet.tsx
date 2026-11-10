import { REPORT_REASONS, type ReportReason } from "@stickers/shared";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { success, tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";
import { Sheet } from "./Sheet";

/** Report a Discover pack: pick a reason, add an optional note. */
export function ReportSheet({ id, visible, onClose, onDone }: { id: string; visible: boolean; onClose: () => void; onDone: () => void }) {
  const { d } = useDiscoverI18n();
  const [reason, setReason] = useState<ReportReason>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    if (!reason) return;
    tap();
    setBusy(true);
    setError(undefined);
    try {
      await (await api()).report(id, { reason, note: note.trim() || undefined });
      success();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{d.reportTitle}</Text>
        <Text style={s.body}>{d.reportBody}</Text>
        <View style={s.list}>
          {REPORT_REASONS.map((r, i) => (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === r }}
              onPress={() => {
                tap();
                setReason(r);
              }}
              style={[s.option, i > 0 && s.border]}
            >
              <Text style={[s.optionText, reason === r && { fontFamily: F.semibold }]}>{d.reasons[r]}</Text>
              {reason === r && <Text style={s.tick}>✓</Text>}
            </Pressable>
          ))}
        </View>
        <TextInput style={s.input} value={note} onChangeText={setNote} placeholder={d.notePlaceholder} placeholderTextColor={C.muted} maxLength={500} multiline />
        {error && <Text style={s.error}>{error}</Text>}
        <View style={s.row}>
          <Pressable style={[s.button, s.secondary]} onPress={onClose}>
            <Text style={[s.buttonText, { color: C.ink }]}>{d.cancel}</Text>
          </Pressable>
          <Pressable style={[s.button, !reason && { opacity: 0.4 }]} disabled={!reason || busy} onPress={send}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{d.sendReport}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

export const sheetStyles = StyleSheet.create({
  title: { fontFamily: F.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  body: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 6 },
});

const s = StyleSheet.create({
  ...sheetStyles,
  list: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginTop: 16 },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink },
  tick: { fontFamily: F.bold, color: C.brand, fontSize: 16 },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 12, minHeight: 64, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: "top" },
  error: { fontFamily: F.regular, color: C.danger, marginTop: 10, textAlign: "center" },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  button: { flex: 1, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, alignItems: "center" },
  secondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
});
