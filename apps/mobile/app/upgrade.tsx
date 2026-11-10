import { fmt, hoursUntil, type Usage } from "@stickers/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F, shadow } from "@/lib/theme";
import { usageLine } from "@/lib/usage";

/**
 * Free packs left today and the plans. Opened from Settings, or with ?reason=quota when the
 * server refused a new pack because today's free packs are used up.
 * Pro has no purchase button until in-app purchases are set up in the stores.
 */
export default function Upgrade() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { m } = useI18n();
  const t = m.usage;
  const [usage, setUsage] = useState<Usage>();

  useEffect(() => {
    void api()
      .then((a) => a.getUsage())
      .then((r) => setUsage(r.usage))
      .catch(() => undefined);
  }, []);

  const limit = usage?.limit ?? 2;
  const hours = usage ? hoursUntil(usage.resetsAt) : 24;

  return (
    <ScrollView contentContainerStyle={s.page}>
      {reason === "quota" ? (
        <View style={s.head}>
          <Text style={s.emoji}>⏳</Text>
          <Text style={s.title}>{t.quotaTitle}</Text>
          <Text style={s.body}>{fmt(t.quotaBody, { n: limit, h: hours })}</Text>
        </View>
      ) : (
        usage && (
          <View style={s.head}>
            <Text style={s.title}>{usageLine(m, usage)}</Text>
            {usage.limit > 0 && usage.used > 0 && <Text style={s.body}>{fmt(t.resets, { h: hours })}</Text>}
          </View>
        )
      )}

      <View style={s.plan}>
        <Text style={s.planName}>{t.freeName}</Text>
        <Text style={s.planPrice}>{fmt(t.freePrice, { n: limit })}</Text>
        {t.freePerks.map((p) => (
          <Text key={p} style={s.perk}>
            ✓ {p}
          </Text>
        ))}
      </View>

      <View style={[s.plan, s.pro]}>
        <View style={s.proTop}>
          <Text style={[s.planName, { color: "#fff" }]}>{t.proName}</Text>
          <Text style={s.soon}>{t.proSoon}</Text>
        </View>
        {t.proPerks.map((p) => (
          <Text key={p} style={[s.perk, { color: "rgba(255,255,255,0.85)" }]}>
            ✓ {p}
          </Text>
        ))}
      </View>

      <Pressable
        style={s.button}
        onPress={() => {
          tap();
          router.back();
        }}
      >
        <Text style={s.buttonText}>{t.gotIt}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 14 },
  head: { alignItems: "center", paddingVertical: 12 },
  emoji: { fontSize: 48 },
  title: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.ink, textAlign: "center", letterSpacing: -0.4, marginTop: 6 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: C.muted, textAlign: "center", marginTop: 8 },
  plan: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 6 },
  pro: { backgroundColor: C.ink, borderColor: C.ink, ...shadow },
  proTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontFamily: F.display, fontSize: 22, color: C.ink },
  planPrice: { fontFamily: F.semibold, fontSize: 15, color: C.muted, marginBottom: 6 },
  soon: { fontFamily: F.semibold, fontSize: 12, color: C.ink, backgroundColor: C.sun, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  perk: { fontFamily: F.regular, fontSize: 15, color: C.ink, lineHeight: 22 },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
});
