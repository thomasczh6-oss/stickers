import { fmt } from "@stickers/shared";
import { router } from "expo-router";
import { useState } from "react";
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CONTACT_EMAIL } from "@/lib/env";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { emailSupport } from "@/lib/links";
import { C, F } from "@/lib/theme";

/** FAQ (tap a question to open it) and a way to reach support. */
export default function Help() {
  const { m } = useI18n();
  const t = m.support;
  const [open, setOpen] = useState<number>();

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.subtitle}>{t.helpSubtitle}</Text>
      <View style={s.card}>
        {t.faq.map((f, i) => (
          <Pressable
            key={f.q}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === i }}
            onPress={() => {
              tap();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpen(open === i ? undefined : i);
            }}
            style={[s.item, i > 0 && s.border]}
          >
            <View style={s.qRow}>
              <Text style={s.q}>{f.q}</Text>
              <Text style={s.plus}>{open === i ? "−" : "+"}</Text>
            </View>
            {open === i && <Text style={s.a}>{f.a}</Text>}
          </Pressable>
        ))}
      </View>

      <View style={s.contact}>
        <Text style={s.contactTitle}>{t.stillStuck}</Text>
        <Text style={s.contactBody}>{t.contactBody}</Text>
        <Pressable style={s.button} onPress={() => router.push("/feedback")}>
          <Text style={s.buttonText}>{t.contact}</Text>
        </Pressable>
        <Pressable onPress={() => emailSupport()} hitSlop={8}>
          <Text style={s.email}>{fmt(t.emailUs, { email: CONTACT_EMAIL })}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48 },
  subtitle: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  item: { paddingHorizontal: 16, paddingVertical: 15 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  qRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  q: { flex: 1, fontFamily: F.semibold, fontSize: 16, color: C.ink, lineHeight: 21 },
  plus: { fontFamily: F.medium, fontSize: 20, color: C.muted },
  a: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 8 },
  contact: { alignItems: "center", backgroundColor: C.brandSoft, borderRadius: 24, padding: 24, marginTop: 24 },
  contactTitle: { fontFamily: F.display, fontSize: 22, color: C.ink },
  contactBody: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: C.muted, textAlign: "center", marginTop: 6 },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 14, paddingHorizontal: 28, marginTop: 16 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  email: { fontFamily: F.medium, fontSize: 14, color: C.ink, textDecorationLine: "underline", marginTop: 14 },
});
