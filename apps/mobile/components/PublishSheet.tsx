import { DISCOVER_LIMITS, type PublishState } from "@stickers/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { success, tap } from "@/lib/haptics";
import { useDiscoverI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";
import { sheetStyles } from "./ReportSheet";
import { Sheet } from "./Sheet";

/** The pack screen's Discover row: share it, or see its status and take it down. Only shown to the creator. */
export function PublishRow({ packId, name, state, onChange }: { packId: string; name: string; state: PublishState; onChange: (s: PublishState) => void }) {
  const { d } = useDiscoverI18n();
  const p = d.publish;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pub = state.publication;

  if (!pub)
    return (
      <>
        <Pressable
          style={s.row}
          onPress={() => {
            tap();
            setOpen(true);
          }}
        >
          <Text style={s.rowIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{p.button}</Text>
            <Text style={s.rowBody} numberOfLines={2}>
              {d.subtitle}
            </Text>
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
        <PublishSheet packId={packId} name={name} visible={open} onClose={() => setOpen(false)} onPublished={onChange} />
      </>
    );

  const dot = pub.status === "visible" ? "#10b981" : pub.status === "removed" ? C.danger : "#f59e0b";
  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{p.status[pub.status]}</Text>
        <Text style={s.rowBody} numberOfLines={1}>
          “{pub.title}”
        </Text>
      </View>
      {pub.status === "visible" && (
        <Pressable onPress={() => router.push({ pathname: "/discover/[id]", params: { id: pub.id } })} hitSlop={8} style={s.small}>
          <Text style={s.smallText}>{p.view}</Text>
        </Pressable>
      )}
      {pub.status !== "removed" && (
        <Pressable
          hitSlop={8}
          disabled={busy}
          style={s.small}
          onPress={async () => {
            tap();
            setBusy(true);
            try {
              onChange(await (await api()).unpublish(packId));
            } finally {
              setBusy(false);
            }
          }}
          accessibilityLabel={p.unpublish}
        >
          {busy ? <ActivityIndicator color={C.muted} /> : <Text style={s.smallText}>✕</Text>}
        </Pressable>
      )}
    </View>
  );
}

function PublishSheet({ packId, name, visible, onClose, onPublished }: { packId: string; name: string; visible: boolean; onClose: () => void; onPublished: (s: PublishState) => void }) {
  const { d } = useDiscoverI18n();
  const p = d.publish;
  const [title, setTitle] = useState(name);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function publish() {
    tap();
    setBusy(true);
    setError(undefined);
    try {
      const state = await (await api()).publish(packId, { title: title.trim() || undefined, agree });
      success();
      onPublished(state);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={sheetStyles.title}>{p.title}</Text>
        <Text style={sheetStyles.body}>{p.body}</Text>
        <Text style={s.label}>{p.titleLabel}</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={DISCOVER_LIMITS.TITLE_MAX} placeholderTextColor={C.muted} />
        <View style={s.rules}>
          {p.rules.map((r) => (
            <Text key={r} style={s.rule}>
              • {r}
            </Text>
          ))}
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/terms#community`)} hitSlop={6}>
            <Text style={s.guidelines}>{p.guidelines} ↗</Text>
          </Pressable>
        </View>
        <View style={s.agree}>
          <Text style={s.agreeText}>{p.agree}</Text>
          <Switch value={agree} onValueChange={setAgree} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
        </View>
        {error && <Text style={s.error}>{error}</Text>}
        <View style={s.buttons}>
          <Pressable style={[s.button, s.secondary]} onPress={onClose}>
            <Text style={[s.buttonText, { color: C.ink }]}>{d.cancel}</Text>
          </Pressable>
          <Pressable style={[s.button, !agree && { opacity: 0.4 }]} disabled={!agree || busy} onPress={publish}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{p.submit}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 18 },
  rowIcon: { fontSize: 20, color: C.ink, backgroundColor: C.sun, width: 40, height: 40, borderRadius: 20, textAlign: "center", lineHeight: 40, overflow: "hidden" },
  rowTitle: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  rowBody: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  chev: { fontSize: 24, color: C.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  small: { borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, minWidth: 36, alignItems: "center" },
  smallText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink, marginTop: 18, marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.regular, color: C.ink },
  rules: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 14, gap: 6 },
  rule: { fontFamily: F.regular, fontSize: 14, lineHeight: 19, color: C.ink },
  guidelines: { fontFamily: F.semibold, fontSize: 14, color: C.brand, marginTop: 4 },
  agree: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  agreeText: { flex: 1, fontFamily: F.medium, fontSize: 14, color: C.ink },
  error: { fontFamily: F.regular, color: C.danger, marginTop: 10, textAlign: "center" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 16 },
  button: { flex: 1, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, alignItems: "center" },
  secondary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
});
